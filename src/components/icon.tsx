import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArchive,
  IconArrowDown,
  IconArrowUp,
  IconArrowsMove,
  IconCalendar,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconCopy,
  IconDeviceDesktop,
  IconDownload,
  IconHome,
  IconInfoCircle,
  IconKey,
  IconLanguage,
  IconLock,
  IconLogout,
  IconMinus,
  IconMoon,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconRestore,
  IconSearch,
  IconShieldLock,
  IconSpeakerphone,
  IconStarFilled,
  IconSun,
  IconTrash,
  IconUpload,
  IconUserPlus,
  IconUsers,
  IconX,
} from "@tabler/icons-react";

// Copied from NoorAI Lab Studio (apps/web/src/components/Icon.tsx).
// Tabler Icons, outline, 2px stroke, currentColor (brand book, "Iconography").
// Icons always sit beside a word, so they are hidden from screen readers.
const icons = {
  check: IconCheck,
  clock: IconClock,
  x: IconX,
  minus: IconMinus,
  info: IconInfoCircle,
  megaphone: IconSpeakerphone,
  star: IconStarFilled,
  sun: IconSun,
  moon: IconMoon,
  computer: IconDeviceDesktop,
  language: IconLanguage,
  online: IconCircleCheck,
  offline: IconAlertTriangle,
  error: IconAlertCircle,
  lock: IconLock,
  key: IconKey,
  shield: IconShieldLock,
  signOut: IconLogout,
  home: IconHome,
  people: IconUsers,
  addPerson: IconUserPlus,
  plus: IconPlus,
  search: IconSearch,
  edit: IconPencil,
  archive: IconArchive,
  restore: IconRestore,
  print: IconPrinter,
  upload: IconUpload,
  calendar: IconCalendar,
  move: IconArrowsMove,
  // Added in Tracks for the Roadmap Builder.
  up: IconArrowUp,
  down: IconArrowDown,
  download: IconDownload,
  copy: IconCopy,
  trash: IconTrash,
};

export type IconName = keyof typeof icons;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const Glyph = icons[name];
  return (
    <Glyph size={size} stroke={2} aria-hidden="true" focusable="false" style={{ flex: "none" }} />
  );
}
