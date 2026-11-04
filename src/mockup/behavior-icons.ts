// One icon per CMAI behavior, so a caregiver can find a tile at a glance.
// Icons are from Lucide (https://lucide.dev, ISC License; see NOTICE). A first pass for
// the mockup: swap any of them here, and every tile updates. The name on the tile stays
// the thing to read; the icon only helps the eye find it.
import {
  Armchair,
  ArrowDownToLine,
  AudioWaveform,
  BellRing,
  Bone,
  Boxes,
  DoorOpen,
  Droplet,
  EyeOff,
  Footprints,
  Hammer,
  Hand,
  HandFist,
  HandGrab,
  Megaphone,
  MessageCircleMore,
  MessageSquareHeart,
  MessageSquareWarning,
  PackageOpen,
  Pointer,
  Repeat,
  Route,
  Send,
  ShieldAlert,
  Shirt,
  Signature,
  ThumbsDown,
  TriangleAlert,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export const BEHAVIOR_ICONS: Record<number, LucideIcon> = {
  1: Route, // pacing, aimless wandering
  2: Shirt, // inappropriate dressing or disrobing
  3: Droplet, // spitting
  4: MessageSquareWarning, // cursing or verbal aggression
  5: BellRing, // constant request for attention or help
  6: Repeat, // repetitive sentences or questions
  7: HandFist, // hitting
  8: Footprints, // kicking
  9: HandGrab, // grabbing
  10: Hand, // pushing
  11: Send, // throwing things
  12: AudioWaveform, // strange noises
  13: Megaphone, // screaming
  14: Bone, // biting
  15: Signature, // scratching
  16: DoorOpen, // trying to get to a different place
  17: ArrowDownToLine, // intentional falling
  18: MessageCircleMore, // complaining
  19: ThumbsDown, // negativism
  20: UtensilsCrossed, // eating or drinking inappropriate substances
  21: TriangleAlert, // hurting self or other
  22: PackageOpen, // handling things inappropriately
  23: EyeOff, // hiding things
  24: Boxes, // hoarding things
  25: Hammer, // tearing things or destroying property
  26: Pointer, // repetitious mannerisms
  27: MessageSquareHeart, // verbal sexual advances
  28: ShieldAlert, // physical sexual advances or exposing genitals
  29: Armchair, // general restlessness
};
