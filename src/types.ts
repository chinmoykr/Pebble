import { TFile } from 'obsidian';

export interface PebbleSettings {
	folderPath: string;
	cardsPerPage: number;
	attachmentFolderPath: string;
}

export const DEFAULT_SETTINGS: PebbleSettings = {
	folderPath: 'Pebbles',
	cardsPerPage: 20,
	attachmentFolderPath: ''
};

export interface PebbleMetadata {
	file: TFile;
	created: number;
	tags: string[];
}
