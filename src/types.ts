import { TFile } from 'obsidian';

export interface PebbleSettings {
	folderPath: string;
	cardsPerPage: number;
}

export const DEFAULT_SETTINGS: PebbleSettings = {
	folderPath: 'Pebbles',
	cardsPerPage: 20
};

export interface PebbleMetadata {
	file: TFile;
	created: number;
	tags: string[];
}
