

const N = 15;
const SIZE = 800;
const MARGIN = 46;
const SPACING = (SIZE - MARGIN * 2) / (N - 1);
const HIT_R = SPACING * 0.42;
const WIN_LENGTH = 5;
const SEATS = 2;
const MODE_OPTIONS = ['skill', 'wave', '3d', 'fight', 'rps', 'disaster', 'teams', 'blind', 'moving', 'multi-stone'];
const SEED_TIME_MODULUS = 100000;
const SEED_RANDOM_RANGE = 1000;

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;
const DRAG_THRESHOLD = 6;

const STONE_COLORS = ['black', 'white', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'];
const DEFAULT_STONE_COLOR = STONE_COLORS[0];
const PROFILE_NICK_MAX_LENGTH = 12;

const HOST_RECONNECT_GRACE_MS = 20000;
const CHAT_LIMIT = 50;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;
const ROOM_GRACE_MS = 15000;
const ROOM_MAX_DEFAULT = 8;
const ROOM_MAX_LIMIT = 20;

const WAVE_DEFAULT_INTENSITY = 0.6;
const WAVE_PRIMARY_AMPLITUDE = 0.62;
const WAVE_SECONDARY_AMPLITUDE = 0.26;
const WAVE_PRIMARY_FREQUENCY = 0.55;
const WAVE_SECONDARY_FREQUENCY = 1.25;
const TANGLE_MIN_GAP = SPACING * 0.16;
const DAMP_STEP = 0.93;
const MAX_REPAIR_ITER = 40;
