import { App, moment, Notice } from 'obsidian';
import { PebbleSettings } from '../types';
import { PebbleManager } from './pebble_manager';

export class AttachmentManager {
	static async saveAttachment(app: App, settings: PebbleSettings, file: File): Promise<string> {
		const arrayBuffer = await file.arrayBuffer();
		
		const timestamp = moment().format('YYYYMMDDHHmmssSSS');
		// Get original extension
		const extMatch = file.name.match(/\.([^.]+)$/);
		const ext = extMatch ? extMatch[1] : 'bin';
		
		// Create a clean filename
		const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
		const newFilename = `${cleanName}_${timestamp}.${ext}`;
		
		let targetPath = '';
		if (settings.attachmentFolderPath) {
			await PebbleManager.ensureFolderExists(app, settings.attachmentFolderPath);
			targetPath = `${settings.attachmentFolderPath}/${newFilename}`;
		} else {
			targetPath = await app.fileManager.getAvailablePathForAttachment(newFilename);
		}

		await app.vault.createBinary(targetPath, arrayBuffer);

		const isImage = file.type.startsWith('image/');
		
		if (isImage) {
			return `![[${targetPath.split('/').pop()}]]`;
		} else {
			return `[[${targetPath.split('/').pop()}]]`;
		}
	}

	static async handleAttachments(app: App, settings: PebbleSettings, files: FileList | File[], textarea: HTMLTextAreaElement): Promise<boolean> {
		let handled = false;
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			if (!file || !file.type || (!file.type.startsWith('image/') && file.type !== 'application/pdf')) {
				continue;
			}
			
			handled = true;
			try {
				const mdLink = await this.saveAttachment(app, settings, file);
				const insertText = mdLink + ' ';
				
				const startPos = textarea.selectionStart;
				const endPos = textarea.selectionEnd;
				const text = textarea.value;
				
				textarea.value = text.substring(0, startPos) + insertText + text.substring(endPos);
				
				textarea.selectionStart = textarea.selectionEnd = startPos + insertText.length;
				textarea.focus();
				textarea.dispatchEvent(new Event('input', { bubbles: true }));
			} catch (e) {
				console.error("Failed to save attachment:", e);
				new Notice("Failed to save attachment");
			}
		}
		return handled;
	}
}
