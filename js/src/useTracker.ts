import {
  computed,
  inject,
  onMounted,
  onUnmounted,
  provide,
  ref,
  shallowRef,
  watch,
  type InjectionKey,
} from 'vue';
import config from '../.generated/config.json';
import { BungieTransport } from './api';
import { PlayerLogin, type PlayerAccount } from './auth';
import { collapseCrossSaveMembers } from './clan';
import {
  ClanDirectory,
  readClanSelection,
  recentClans,
  type ClanChoice,
} from './clanSearch';
import { badgeOwnership, sealAwarded } from './domain';
import { FriendDirectory, type FriendClan } from './friends';
import { memberKey } from './members';
import { combinePlayers, friendMembers, type PlayerList } from './playerLists';
import { profileFresh } from './policy';
import { eachLimited, TrackerRepository } from './repository';
import { CacheStore } from './storage';
import type {
  Cell,
  Definitions,
  Heading,
  LoadResult,
  PlayerData,
  Profile,
  ProfilePass,
  Roster,
  UserInfo,
} from './types';
import { usePageView } from './usePageView';
import { useTableRows } from './useTableRows';
import { useTooltip } from './useTooltip';

/**
 * The app's shared state and actions. Page-level components read it through
 * useTracker(); leaf components keep taking plain props.
 */
function createTracker() {
  const store = new CacheStore();
  const transport = new BungieTransport(config.apiKey, (diagnostic) =>
    store.recordDiagnostic(diagnostic),
  );
  const account = shallowRef<PlayerAccount>();
  const ownClan = shallowRef<ClanChoice>();
  const loginNotice = ref('');
  const playerList = ref<PlayerList>('clan');
  const login = new PlayerLogin(
    config as {
      apiKey: string;
      oauthClientId?: string;
      oauthRedirectUri?: string;
    },
    undefined,
    (message) => {
      if (account.value) void signOut(message);
      else loginNotice.value = message;
    },
  );
  const friendDirectory = new FriendDirectory(login, transport);
  const friendClans = shallowRef<FriendClan[]>([]);
  const friendsLoading = ref(false),
    friendsError = ref('');
  let friendsGeneration = 0;
  let loginExpiryTimer: ReturnType<typeof setTimeout> | undefined;
  const fallbackClan: ClanChoice = {
    id: config.clanId,
    name: `Clan ${config.clanId}`,
  };
  const clanSelection = shallowRef(readClanSelection(undefined, fallbackClan));
  const clanPickerOpen = ref(false);
  const clanDirectory = new ClanDirectory(transport);
  let repository = new TrackerRepository(
    store,
    transport,
    config.clanId,
    config.language,
    login,
  );
  let clanGeneration = 0;
  const passPreferenceKey = (id = repository.clanId) =>
    playerList.value === 'clan'
      ? `lastProfilePass:v2:${id}`
      : `lastProfilePass:v3:${playerList.value}:${account.value?.membershipId}:${playerList.value === 'combined' ? (ownClan.value?.id ?? 'none') : ''}`;
  const definitions = shallowRef<Definitions>();
  const roster = shallowRef<Roster>();
  const players = shallowRef<Record<string, PlayerData>>({});
  const displayedPlayers = computed(() =>
    collapseCrossSaveMembers(Object.values(players.value)),
  );
  const linkedPlatforms = shallowRef<Record<string, UserInfo[]>>({});
  const retryingPlayer = ref<string>();
  const busy = ref(true),
    phase = ref('Starting tracker…'),
    issues = ref<string[]>([]),
    storageWarning = ref('');
  const rosterState = ref(''),
    definitionsState = ref('');
  const profileSyncActive = ref(false),
    profileSyncDone = ref(0),
    profileSyncTotal = ref(0);
  const manifestCheckedAt = ref<number>(),
    clanCheckedAt = ref<number>();
  const lastProfilePass = ref<ProfilePass>();
  const locationHash = () =>
    window.location.hash ||
    (/\/members\/?$/.test(window.location.pathname) ? '#/members' : '');
  const hash = ref(locationHash());
  const {
    isMembers,
    routeMode,
    routeId,
    groupedPage,
    isHome,
    seals,
    sealsById,
    pageMode,
    selectedTemplate,
    selected,
    currentPage,
    headingTitle,
    headingKind,
    activeTriumphsOnly,
    viewDescription,
    breadcrumb,
    viewLabel,
    viewTabs,
    metricView,
    collectionView,
    summaryLabel,
  } = usePageView(hash, definitions);
  const search = ref(''),
    filter = ref('all'),
    sort = ref('progress');
  const badgeClass = ref('best');
  const preferencesReady = ref(false);
  const sidebarCollapsed = ref(false);
  const detail = shallowRef<{ player: string; heading: Heading; cell: Cell }>();
  const {
    tooltip,
    tooltipElement,
    closeTooltip,
    positionTooltip,
    openTooltip,
    showCharacterTooltip,
    showTooltip,
    leaveRecordTooltip,
  } = useTooltip();
  const rows = useTableRows({
    selected,
    selectedTemplate,
    routeMode,
    metricView,
    displayedPlayers,
    linkedPlatforms,
    search,
    filter,
    sort,
    badgeClass,
  });
  async function showGuardianTooltip(event: Event, guardian: PlayerData) {
    const earnedTitle =
      selected.value &&
      routeMode.value !== 'badge' &&
      sealAwarded(guardian.profile, selected.value)
        ? selected.value.title
        : undefined;
    const badge =
      selected.value && routeMode.value === 'badge'
        ? badgeOwnership(guardian.profile, selected.value.headings)
        : undefined;
    const earnedBadge = badge?.completeClasses.length
      ? { ...badge, name: selected.value!.page.name }
      : undefined;
    const id = await openTooltip(event, {
      kind: 'guardian',
      guardian,
      earnedTitle,
      earnedBadge,
      loading: true,
    });
    try {
      const memberships = await repository.memberships(
        guardian.member.destinyUserInfo,
      );
      if (tooltip.value?.id === id && tooltip.value.kind === 'guardian')
        tooltip.value = { ...tooltip.value, memberships, loading: false };
    } catch {
      if (tooltip.value?.id === id && tooltip.value.kind === 'guardian')
        tooltip.value = {
          ...tooltip.value,
          loading: false,
          error: 'Additional platform names are unavailable.',
        };
    }
    await positionTooltip(id);
  }
  watch(metricView, () => {
    if (['complete', 'incomplete'].includes(filter.value)) filter.value = 'all';
  });
  const known = computed(() =>
    displayedPlayers.value.filter((p) => !!p.profile?.profileRecords?.data),
  );
  const resolved = computed(
    () =>
      Object.values(players.value).filter((p) => p.status !== 'loading').length,
  );
  const failedCount = computed(
    () =>
      Object.values(players.value).filter((p) => p.status === 'unavailable')
        .length,
  );
  const staleCount = computed(
    () =>
      Object.values(players.value).filter(
        (p) => p.status === 'stale' || p.status === 'private',
      ).length,
  );
  const syncColor = computed(() =>
    busy.value
      ? 'amber'
      : issues.value.length || failedCount.value
        ? 'red'
        : staleCount.value || storageWarning.value
          ? 'amber'
          : 'green',
  );
  const titleCount = (seal: (typeof seals.value)[number]) =>
    known.value.filter((p) => sealAwarded(p.profile, seal)).length;
  const changedHash = () => {
    hash.value = locationHash();
    detail.value = undefined;
    closeTooltip();
  };
  function applyProfile(
    member: PlayerData['member'],
    result: LoadResult<Profile>,
  ) {
    const previous = players.value[memberKey(member)];
    if (
      previous &&
      JSON.stringify(previous.member) === JSON.stringify(member) &&
      previous.profile === result.entry?.value &&
      (previous.status === result.status ||
        (result.status === 'cached' && previous.status === 'fresh')) &&
      previous.fetchedAt === result.entry?.fetchedAt &&
      previous.error === result.error
    )
      return;
    players.value = {
      ...players.value,
      [memberKey(member)]: {
        member,
        profile: result.entry?.value,
        status: result.status,
        fetchedAt: result.entry?.fetchedAt,
        error: result.error,
      },
    };
    storageWarning.value = store.warning;
  }
  async function loadClanPlatforms(
    value: Roster,
    generation: number,
    repo: TrackerRepository,
  ) {
    await eachLimited(
      value.members.filter(
        (member) => !member.destinyUserInfo.crossSaveOverride,
      ),
      async (member) => {
        const key = memberKey(member);
        if (generation !== clanGeneration || linkedPlatforms.value[key]) return;
        try {
          const memberships = await repo.memberships(member.destinyUserInfo);
          if (generation === clanGeneration)
            linkedPlatforms.value = {
              ...linkedPlatforms.value,
              [key]: memberships,
            };
        } catch {
          /* Keep the unlabelled row until linked platforms can be checked. */
        }
      },
    );
  }
  async function hydrate(rosterValue: Roster) {
    const generation = clanGeneration;
    const current = Object.values(players.value);
    if (
      current.length === rosterValue.members.length &&
      rosterValue.members.every((member) => {
        const old = players.value[memberKey(member)];
        return old && JSON.stringify(old.member) === JSON.stringify(member);
      })
    )
      return;
    const next: Record<string, PlayerData> = {};
    await Promise.all(
      rosterValue.members.map(async (member) => {
        const old = players.value[memberKey(member)];
        const entry = await repository.cachedProfile(member);
        next[memberKey(member)] = old
          ? { ...old, member }
          : entry
            ? {
                member,
                profile: entry.value,
                fetchedAt: entry.fetchedAt,
                error: entry.error,
                status: entry.private
                  ? 'private'
                  : profileFresh(entry, member)
                    ? 'cached'
                    : 'stale',
              }
            : { member, status: 'loading' };
      }),
    );
    if (generation === clanGeneration) players.value = next;
  }
  let rosterHydration: Promise<void> = Promise.resolve();
  function acceptDefinitions(result: LoadResult<Definitions>) {
    if (result.entry) {
      definitions.value = result.entry.value;
      manifestCheckedAt.value = result.entry.fetchedAt;
    }
    definitionsState.value = result.status;
  }
  function acceptRoster(result: LoadResult<Roster>) {
    if (result.entry) {
      roster.value = result.entry.value;
      clanCheckedAt.value = result.entry.fetchedAt;
      rosterHydration = hydrate(result.entry.value);
    }
    rosterState.value = result.status;
  }
  async function listRoster(
    repo: TrackerRepository,
    force: boolean,
    generation: number,
  ): Promise<LoadResult<Roster>> {
    if (playerList.value === 'clan')
      return repo.roster((result) => {
        if (generation === clanGeneration) acceptRoster(result);
      }, force);
    const mode = playerList.value;
    const clanRepo = ownClan.value
      ? new TrackerRepository(
          store,
          transport,
          ownClan.value.id,
          config.language,
          login,
        )
      : undefined;
    const [clanResult, friendResult] = await Promise.all([
      mode === 'combined' && clanRepo
        ? clanRepo.roster(() => {}, force)
        : Promise.resolve(undefined),
      (async () => {
        try {
          const friends = await friendDirectory.friendList(force);
          const members = await friendMembers(
            friends,
            (user) => repo.memberships(user),
            () => generation === clanGeneration,
          );
          return { members, error: undefined as string | undefined };
        } catch {
          return {
            members:
              roster.value?.members.filter((member) => member.isFriend) ?? [],
            error:
              'Friends could not be refreshed. Check ReadUserData permission and your connection, then retry.',
          };
        }
      })(),
    ]);
    const errors = [
      clanResult?.error,
      friendResult.error,
      mode === 'combined' && !ownClan.value
        ? 'No clan was found for your account; showing friends.'
        : undefined,
    ]
      .filter(Boolean)
      .join(' ');
    const clan = clanResult?.entry?.value;
    const value: Roster = {
      name:
        mode === 'friends'
          ? `${account.value?.name ?? 'My'}’s friends`
          : (clan?.name ?? ownClan.value?.name ?? 'My clan and friends'),
      emblem: clan?.emblem,
      members:
        mode === 'combined'
          ? combinePlayers(clan?.members ?? [], friendResult.members)
          : friendResult.members,
    };
    return {
      entry: {
        key: 'session-player-list',
        value,
        fetchedAt:
          mode === 'friends'
            ? (friendDirectory.friendCheckedAt ?? Date.now())
            : (clanResult?.entry?.fetchedAt ??
              friendDirectory.friendCheckedAt ??
              Date.now()),
      },
      status: errors ? 'stale' : 'fresh',
      error: errors || undefined,
    };
  }
  async function changePlayerList(mode: PlayerList) {
    if (
      (mode !== 'clan' && !account.value) ||
      !['clan', 'friends', 'combined'].includes(mode)
    )
      return;
    if (playerList.value === mode) return;
    const generation = ++clanGeneration;
    playerList.value = mode;
    closeTooltip();
    detail.value = undefined;
    roster.value = undefined;
    players.value = {};
    linkedPlatforms.value = {};
    rosterHydration = Promise.resolve();
    lastProfilePass.value = undefined;
    clanCheckedAt.value = undefined;
    search.value = '';
    filter.value = 'all';
    issues.value = [];
    profileSyncActive.value = false;
    busy.value = false;
    await store.setPreference('playerList', mode);
    if (generation === clanGeneration) await load();
  }
  async function load(force = false) {
    if (busy.value) return;
    const generation = clanGeneration,
      repo = repository;
    const current = () => generation === clanGeneration;
    retryingPlayer.value = undefined;
    busy.value = true;
    issues.value = [];
    profileSyncActive.value = false;
    profileSyncDone.value = 0;
    profileSyncTotal.value = 0;
    phase.value =
      playerList.value === 'clan'
        ? 'Checking definitions and clan roster…'
        : 'Checking definitions and friends…';
    try {
      const [d, r] = await Promise.all([
        repo.definitions((result) => {
          if (current()) acceptDefinitions(result);
        }, force),
        listRoster(repo, force, generation),
      ]);
      if (!current()) return;
      acceptDefinitions(d);
      await rosterHydration;
      if (!current()) return;
      if (r.entry) {
        roster.value = r.entry.value;
        clanCheckedAt.value = r.entry.fetchedAt;
        await hydrate(r.entry.value);
      }
      if (!current()) return;
      rosterState.value = r.status;
      issues.value = [d.error, r.error].filter((v): v is string => !!v);
      if (r.entry) {
        void loadClanPlatforms(r.entry.value, generation, repo);
        // Friend and combined lists must not replace the visitor's selected clan.
        if (playerList.value === 'clan') {
          const selectedClan = {
            ...clanSelection.value.selected,
            name: r.entry.value.name,
            memberCount: r.entry.value.members.length,
          };
          clanSelection.value = {
            selected: selectedClan,
            recent: recentClans(clanSelection.value.recent, selectedClan),
          };
          await store.setPreference('clanSelection', clanSelection.value);
        }
        if (!current()) return;
        phase.value = 'Checking profiles…';
        profileSyncTotal.value = r.entry.value.members.length;
        profileSyncDone.value = 0;
        profileSyncActive.value = true;
        const pass = {
          completedAt: 0,
          loaded: 0,
          reused: 0,
          private: 0,
          unavailable: 0,
        };
        await eachLimited(r.entry.value.members, async (member) => {
          if (!current()) return;
          const result = await repo.profile(
            member,
            (cached) => {
              if (current()) applyProfile(member, cached);
            },
            false,
            force,
          );
          if (!current()) return;
          if (result.status === 'fresh') pass.loaded++;
          else if (result.status === 'cached') pass.reused++;
          else if (result.status === 'private') pass.private++;
          else pass.unavailable++;
          applyProfile(member, result);
          profileSyncDone.value++;
        });
        if (!current()) return;
        pass.completedAt = Date.now();
        if (
          force ||
          pass.loaded ||
          pass.private ||
          pass.unavailable ||
          !lastProfilePass.value
        ) {
          lastProfilePass.value = pass;
          await store.setPreference(passPreferenceKey(repo.clanId), pass);
        }
      }
      if (current()) phase.value = 'Ready';
    } catch {
      if (current()) {
        issues.value = [
          ...issues.value,
          'The tracker could not finish loading. Retry to continue.',
        ];
        phase.value = 'Loading stopped';
      }
    } finally {
      if (current()) {
        profileSyncActive.value = false;
        busy.value = false;
        storageWarning.value = store.warning;
      }
    }
  }
  async function loadFriends(force = false) {
    if (!account.value || friendsLoading.value) return;
    const generation = friendsGeneration;
    friendsLoading.value = true;
    friendsError.value = '';
    try {
      const result = await friendDirectory.load(force);
      if (generation !== friendsGeneration) return;
      friendClans.value = result.clans;
      if (result.failed)
        friendsError.value = `Could not check clans for ${result.failed} friends. Other suggestions are available.`;
    } catch {
      if (generation === friendsGeneration)
        friendsError.value =
          'Could not load friends. Enable ReadUserData in the Bungie app permissions and sign in again, or retry if this was a connection error.';
    } finally {
      if (generation === friendsGeneration) friendsLoading.value = false;
    }
  }
  watch(clanPickerOpen, (open) => {
    if (open) void loadFriends();
  });
  function signIn() {
    loginNotice.value = '';
    try {
      window.location.assign(login.begin());
    } catch (error) {
      loginNotice.value =
        error instanceof Error ? error.message : 'Cannot start login.';
    }
  }
  async function signOut(message = '') {
    clearTimeout(loginExpiryTimer);
    ++friendsGeneration;
    friendDirectory.clear();
    friendClans.value = [];
    friendsLoading.value = false;
    friendsError.value = '';
    login.end();
    playerList.value = 'clan';
    account.value = undefined;
    ownClan.value = undefined;
    loginNotice.value = message;
    // Invalidate pending callbacks and remove every private value from the UI immediately.
    ++clanGeneration;
    closeTooltip();
    detail.value = undefined;
    players.value = {};
    repository = new TrackerRepository(
      store,
      transport,
      clanSelection.value.selected.id,
      config.language,
      login,
    );
    rosterHydration = Promise.resolve();
    busy.value = false;
    profileSyncActive.value = false;
    await load();
  }
  function checkLoginExpiry() {
    if (account.value && (!login.expiresAt || login.expiresAt <= Date.now()))
      void signOut(
        'Your login expired. Sign in again to access your private progression.',
      );
  }
  async function selectClan(clan: ClanChoice) {
    clan = { id: clan.id, name: clan.name, memberCount: clan.memberCount };
    clanPickerOpen.value = false;
    if (clan.id === repository.clanId) {
      if (playerList.value !== 'clan') await changePlayerList('clan');
      return;
    }
    const generation = ++clanGeneration;
    playerList.value = 'clan';
    closeTooltip();
    detail.value = undefined;
    clanSelection.value = {
      selected: clan,
      recent: recentClans(clanSelection.value.recent, clan),
    };
    repository = new TrackerRepository(
      store,
      transport,
      clan.id,
      config.language,
      login,
    );
    roster.value = undefined;
    players.value = {};
    linkedPlatforms.value = {};
    rosterState.value = '';
    clanCheckedAt.value = undefined;
    lastProfilePass.value = undefined;
    rosterHydration = Promise.resolve();
    issues.value = [];
    profileSyncActive.value = false;
    profileSyncDone.value = 0;
    profileSyncTotal.value = 0;
    search.value = '';
    filter.value = 'all';
    busy.value = true;
    phase.value = 'Loading clan…';
    await store.setPreference('playerList', 'clan');
    await store.setPreference('clanSelection', clanSelection.value);
    const pass = await store.preference<typeof lastProfilePass.value>(
      passPreferenceKey(),
      undefined,
    );
    if (generation !== clanGeneration) return;
    lastProfilePass.value = pass;
    busy.value = false;
    await load();
  }
  async function clearCache() {
    if (
      busy.value ||
      !window.confirm(
        'Clear cached Bungie data and download it again? Your filters and preferences will be kept.',
      )
    )
      return;
    const generation = clanGeneration,
      preferenceKey = passPreferenceKey();
    busy.value = true;
    phase.value = 'Clearing API cache…';
    try {
      await store.clearCache();
      await login.store.clearCache();
      if (generation !== clanGeneration) return;
      lastProfilePass.value = undefined;
      manifestCheckedAt.value = undefined;
      clanCheckedAt.value = undefined;
      await store.setPreference(preferenceKey, null);
      if (repository.clanId === config.clanId)
        await store.setPreference('lastProfilePass:v2', null);
      if (generation !== clanGeneration) return;
      definitions.value = undefined;
      roster.value = undefined;
      players.value = {};
      detail.value = undefined;
    } finally {
      if (generation === clanGeneration) busy.value = false;
    }
    if (generation === clanGeneration) await load();
  }
  async function retryPlayer(id: string) {
    const player = players.value[id];
    if (!player || busy.value) return;
    const generation = clanGeneration,
      repo = repository;
    retryingPlayer.value = id;
    busy.value = true;
    phase.value = 'Retrying profile…';
    try {
      const result = await repo.profile(
        player.member,
        (cached) => {
          if (generation === clanGeneration)
            applyProfile(player.member, cached);
        },
        true,
      );
      if (generation === clanGeneration) applyProfile(player.member, result);
    } finally {
      if (generation === clanGeneration) {
        retryingPlayer.value = undefined;
        busy.value = false;
        phase.value = 'Ready';
      }
    }
  }
  function showDetail(player: string, heading: Heading, cell: Cell) {
    closeTooltip();
    detail.value = { player, heading, cell };
  }
  const loadMemberships = (user: UserInfo) => repository.memberships(user);
  const loadEntitlements = () => repository.memberEntitlements();
  watch([search, filter, sort], () => {
    if (preferencesReady.value)
      void store.setPreference('table', {
        search: search.value,
        filter: filter.value,
        sort: sort.value,
      });
  });
  watch(sidebarCollapsed, (value) => {
    closeTooltip();
    if (preferencesReady.value)
      void store.setPreference('sidebarCollapsed', value);
  });
  onMounted(async () => {
    window.addEventListener('hashchange', changedHash);
    window.addEventListener('focus', checkLoginExpiry);
    document.addEventListener('visibilitychange', checkLoginExpiry);
    window.addEventListener('resize', closeTooltip);
    window.addEventListener('scroll', closeTooltip);
    try {
      let signedInNow = false;
      try {
        signedInNow = await login.initialize();
        account.value = login.account;
      } catch (error) {
        loginNotice.value =
          error instanceof Error ? error.message : 'Login could not finish.';
      }
      hash.value = locationHash();
      if (account.value) {
        loginExpiryTimer = setTimeout(
          checkLoginExpiry,
          Math.min(
            2_147_483_647,
            Math.max(0, (login.expiresAt ?? 0) - Date.now()),
          ),
        );
        try {
          ownClan.value = await login.clan(transport);
        } catch {
          loginNotice.value =
            'Signed in, but your clan could not be found. You can choose a clan below.';
        }
      }
      const preferences = await store.preference('table', {
        search: '',
        filter: 'all',
        sort: 'progress',
      });
      clanSelection.value = readClanSelection(
        await store.preference('clanSelection', undefined),
        fallbackClan,
      );
      if (signedInNow && ownClan.value) {
        clanSelection.value = {
          selected: ownClan.value,
          recent: recentClans(clanSelection.value.recent, ownClan.value),
        };
        await store.setPreference('clanSelection', clanSelection.value);
      }
      const savedList = await store.preference<string>('playerList', 'clan');
      playerList.value =
        account.value && ['friends', 'combined'].includes(savedList)
          ? (savedList as PlayerList)
          : 'clan';
      repository = new TrackerRepository(
        store,
        transport,
        clanSelection.value.selected.id,
        config.language,
        login,
      );
      lastProfilePass.value = await store.preference<
        typeof lastProfilePass.value
      >(
        passPreferenceKey(),
        playerList.value === 'clan' &&
          clanSelection.value.selected.id === config.clanId
          ? await store.preference('lastProfilePass:v2', undefined)
          : undefined,
      );
      sidebarCollapsed.value =
        (await store.preference('sidebarCollapsed', false)) === true;
      search.value =
        typeof preferences.search === 'string' ? preferences.search : '';
      filter.value = ['all', 'complete', 'incomplete', 'unavailable'].includes(
        preferences.filter,
      )
        ? preferences.filter
        : 'all';
      sort.value = ['progress', 'highest', 'name', 'tenure'].includes(
        preferences.sort,
      )
        ? preferences.sort
        : 'progress';
    } finally {
      preferencesReady.value = true;
      busy.value = false;
      void load();
      void loadFriends();
    }
  });
  onUnmounted(() => {
    clearTimeout(loginExpiryTimer);
    window.removeEventListener('focus', checkLoginExpiry);
    document.removeEventListener('visibilitychange', checkLoginExpiry);
    window.removeEventListener('hashchange', changedHash);
    window.removeEventListener('resize', closeTooltip);
    window.removeEventListener('scroll', closeTooltip);
    closeTooltip();
  });
  return {
    account,
    ownClan,
    loginNotice,
    playerList,
    friendClans,
    friendsLoading,
    friendsError,
    fallbackClan,
    clanSelection,
    clanPickerOpen,
    clanDirectory,
    definitions,
    roster,
    players,
    displayedPlayers,
    retryingPlayer,
    busy,
    phase,
    issues,
    storageWarning,
    rosterState,
    definitionsState,
    profileSyncActive,
    profileSyncDone,
    profileSyncTotal,
    manifestCheckedAt,
    clanCheckedAt,
    lastProfilePass,
    search,
    filter,
    sort,
    badgeClass,
    preferencesReady,
    sidebarCollapsed,
    detail,
    tooltip,
    tooltipElement,
    closeTooltip,
    openTooltip,
    showCharacterTooltip,
    showTooltip,
    leaveRecordTooltip,
    showGuardianTooltip,
    showDetail,
    rows,
    isMembers,
    routeMode,
    routeId,
    groupedPage,
    isHome,
    seals,
    sealsById,
    pageMode,
    selected,
    currentPage,
    headingTitle,
    headingKind,
    activeTriumphsOnly,
    viewDescription,
    breadcrumb,
    viewLabel,
    viewTabs,
    metricView,
    collectionView,
    summaryLabel,
    known,
    resolved,
    failedCount,
    staleCount,
    syncColor,
    titleCount,
    load,
    loadFriends,
    changePlayerList,
    signIn,
    signOut,
    selectClan,
    clearCache,
    retryPlayer,
    loadMemberships,
    loadEntitlements,
  };
}

export type Tracker = ReturnType<typeof createTracker>;
const trackerKey: InjectionKey<Tracker> = Symbol('tracker');

/** Creates the tracker for the app. Call once, from the root component's setup. */
export function provideTracker() {
  const tracker = createTracker();
  provide(trackerKey, tracker);
  return tracker;
}

export const useTracker = () => inject(trackerKey)!;
