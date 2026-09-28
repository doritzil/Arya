import type * as React from 'react';
export type IconName = 'play'|'pause'|'next'|'back'|'chevron-left'|'chevron-right'|'heart'|'timer'|'repeat'|'shuffle'|'mic'|'record'|'sliders'|'metronome'|'speed'|'note'|'check'|'close'|'plus'|'discover'|'learning'|'library'|'alert'|'wave'|'search'|'piano'|'headphones'|'share'|'star'|'settings'|'more'|'sort'|'export'|'trash'|'pencil'|'undo'|'minus'|'redo'|'up'|'down'|'file'|'cloud'|'import';
export declare function Icon(p: { name: IconName; size?: number; label?: string; className?: string }): React.ReactElement;
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary'|'secondary'|'soft'|'ghost'; size?: 'small'; icon?: IconName }
export declare function Button(p: ButtonProps): React.ReactElement;
export declare function IconButton(p: { icon: IconName; label: string; pressed?: boolean; size?: 'small'; glass?: boolean; onClick?: () => void }): React.ReactElement;
export declare function GenreChip(p: { selected?: boolean; onClick?: () => void; children: React.ReactNode }): React.ReactElement;
export type SongStatus = 'recommended'|'learning'|'learned'|'idea';
export declare function StatusPill(p: { status: SongStatus }): React.ReactElement;
export declare function Difficulty(p: { level: 1|2|3|4|5 }): React.ReactElement;
export declare function SongCard(p: { title: string; artist: string; genre?: string; level?: 1|2|3|4|5; status?: SongStatus; variant?: 'recommendation'; footnote?: string; action?: 'play'|'open'; playing?: boolean; progress?: number; repeat?: boolean; onPlay?: () => void; onRepeat?: () => void; wanted?: boolean; onWant?: () => void; onDismiss?: () => void }): React.ReactElement;
export declare function Waveform(p: { progress?: number; height?: number; bars?: number; seed?: number; label?: string }): React.ReactElement;
export declare function NowPlaying(p: { eyebrow?: string; title: string; subtitle?: string; position: number; duration: number; playing?: boolean; loop?: boolean; preview?: boolean; seed?: number; waveHeight?: number }): React.ReactElement;
export declare function PlayerBar(p: { title: string; artist?: string; position?: number; duration?: number; playing?: boolean; repeat?: boolean; preview?: boolean }): React.ReactElement;
export declare function SliderRow(p: { icon?: IconName; label: string; value: number; min?: number; max?: number; unit?: string }): React.ReactElement;
export declare function SourceSwitch(p: { options?: string[]; value?: number; onChange?: (i: number) => void }): React.ReactElement;
export declare function RecordButton(p: { recording?: boolean; time?: string; hint?: string; onClick?: () => void }): React.ReactElement;
export declare function LevelMeter(p: { level: number; warning?: 'quiet'|'clipping' }): React.ReactElement;
export declare function TranscribeProgress(p: { progress: number; stage?: string }): React.ReactElement;
export interface RollNote { p: number; t: number; d: number }
export declare function PianoRoll(p: { notes: RollNote[]; low?: number; high?: number; beats?: number; current?: number }): React.ReactElement;
export interface FallNote { p: number; t: number; d: number; hand?: 'L'|'R' }
export declare function FallingKeys(p: { notes: FallNote[]; now?: number; span?: number; low?: number; high?: number; height?: number; labels?: boolean; label?: string }): React.ReactElement;
export interface ScoreNote { n: string; t: number; d: number; staff?: 'treble'|'bass' }
export declare function Score(p: { notes: ScoreNote[]; beats?: number; flats?: number; time?: string | false; current?: number; selected?: number; width?: number; label?: string }): React.ReactElement;
export declare function TabBar(p: { active: 'discover'|'learning'|'record'|'library' }): React.ReactElement;
