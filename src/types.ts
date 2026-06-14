import { TFile } from 'obsidian';

export interface PebbleSettings {
	folderPath: string;
	cardsPerPage: number;
	attachmentFolderPath: string;
	customProperties: string;
	noteReviewIntegration: boolean;
	noteReviewProperties: string;
	lastNoteReviewState: boolean;
}

export const DEFAULT_SETTINGS: PebbleSettings = {
	folderPath: 'Pebbles',
	cardsPerPage: 20,
	attachmentFolderPath: '',
	customProperties: '',
	noteReviewIntegration: false,
	noteReviewProperties: '',
	lastNoteReviewState: false
};

export interface PebbleMetadata {
	file: TFile;
	created: number;
	tags: string[];
	isNoteReview?: boolean;
}
