import {
  AlarmClock, Bed, BookOpen, Briefcase, Bus, Calendar, Camera, Clock, CloudRain, Coffee, Dumbbell, Film,
  GraduationCap, HeartPulse, Home, Key, Landmark, Laptop, Leaf, MapPin, MessageCircle, Music, Newspaper,
  Palette, Plane, Scale, Shield, ShoppingBag, Sparkles, Sun, Users, Utensils, Wallet, type LucideIcon,
} from "lucide-react";
import type { CourseIcon } from "@/lib/courses/course-catalog";

/** Lucide component for each icon name allowed in content/courses/*.yaml. */
export const LESSON_ICONS: Record<CourseIcon, LucideIcon> = {
  "alarm-clock": AlarmClock, bed: Bed, "book-open": BookOpen, briefcase: Briefcase, bus: Bus, calendar: Calendar,
  camera: Camera, clock: Clock, "cloud-rain": CloudRain, coffee: Coffee, dumbbell: Dumbbell, film: Film,
  "graduation-cap": GraduationCap, "heart-pulse": HeartPulse, home: Home, key: Key, landmark: Landmark, laptop: Laptop,
  leaf: Leaf, "map-pin": MapPin, "message-circle": MessageCircle, music: Music, newspaper: Newspaper, palette: Palette,
  plane: Plane, scale: Scale, shield: Shield, "shopping-bag": ShoppingBag, sparkles: Sparkles, sun: Sun, users: Users,
  utensils: Utensils, wallet: Wallet,
};

export function lessonIcon(name: string): LucideIcon {
  return LESSON_ICONS[name as CourseIcon] ?? BookOpen;
}
