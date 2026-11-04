// One icon per CMAI behavior, so a caregiver can find a tile at a glance.
// Icons come from two open sets drawn on the same 24 px grid with a 2 px line:
// Lucide (https://lucide.dev, ISC) and Tabler (https://tabler.io/icons, MIT), names
// starting with "Icon". Scratching is drawn here because neither set has claw marks.
// Credits are in NOTICE. Swap any icon here and every tile updates. The name on the
// tile stays the thing to read; the icon only helps the eye find it.
import {
  Annoyed,
  Armchair,
  Hammer,
  BellRing,
  Boxes,
  DoorOpen,
  Droplets,
  EyeOff,
  Hand,
  HandFist,
  HandGrab,
  Megaphone,
  MessageSquareHeart,
  MessagesSquare,
  PackageOpen,
  Pointer,
  Shirt,
  ThumbsDown,
  AudioWaveform,
} from "lucide-react";
import {
  IconDental,
  IconFall,
  IconBandage,
  IconHandOff,
  IconKarate,
  IconMessageBolt,
  IconPlayHandball,
  IconToolsKitchen2Off,
  IconWalk,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

type BehaviorIcon = (props: { size?: number; className?: string; "aria-hidden"?: boolean }) => ReactNode;

/** Three claw marks, drawn to match the sets above (24 px grid, 2 px round line). */
function ScratchMarks({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M10 3c-1 6-3 12-6 17" />
      <path d="M15 3.5c-1 6-3 11.5-6 17" />
      <path d="M20 4c-1 6-3 11-6 16.5" />
    </svg>
  );
}

export const BEHAVIOR_ICONS: Record<number, BehaviorIcon> = {
  1: IconWalk, // pacing, aimless wandering: a walking figure
  2: Shirt, // inappropriate dressing or disrobing
  3: Droplets, // spitting: a spray of drops
  4: IconMessageBolt, // cursing or verbal aggression: angry words
  5: BellRing, // constant request for attention or help: a call bell
  6: MessagesSquare, // repetitive sentences or questions: the same thing said again
  7: HandFist, // hitting
  8: IconKarate, // kicking: a figure mid-kick
  9: HandGrab, // grabbing
  10: Hand, // pushing: an open palm
  11: IconPlayHandball, // throwing things: a figure throwing
  12: AudioWaveform, // making strange noises
  13: Megaphone, // screaming
  14: IconDental, // biting: a tooth
  15: ScratchMarks, // scratching: claw marks
  16: DoorOpen, // trying to get to a different place
  17: IconFall, // intentional falling: a falling figure
  18: Annoyed, // complaining: a grumbling face
  19: ThumbsDown, // negativism
  20: IconToolsKitchen2Off, // eating or drinking inappropriate substances: "not food"
  21: IconBandage, // hurting self or other: a bandage
  22: PackageOpen, // handling things inappropriately: rummaging
  23: EyeOff, // hiding things
  24: Boxes, // hoarding things
  25: Hammer, // tearing things or destroying property: smashing
  26: Pointer, // repetitious mannerisms: tapping
  27: MessageSquareHeart, // verbal sexual advances
  28: IconHandOff, // physical sexual advances: unwanted touch
  29: Armchair, // general restlessness: can't stay seated
};
