import { App, TFile, moment } from 'obsidian';
import { PebbleSettings, PebbleMetadata } from '../types';

export class PebbleManager {
	static async ensureFolderExists(app: App, folderPath: string) {
		const folder = app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await app.vault.createFolder(folderPath);
		}
	}

	static extractTags(text: string): string[] {
		const regex = /#([^\s#]+)/g;
		const matches = [...text.matchAll(regex)];
		return matches.map(m => m[1]).filter(Boolean) as string[];
	}

	static async savePebble(app: App, settings: PebbleSettings, text: string): Promise<TFile> {
		await this.ensureFolderExists(app, settings.folderPath);

		const now = moment();
		const timestampStr = now.format('YYYYMMDDTHHmmssSSS');
		const createdStr = now.format('YYYY-MM-DDTHH:mm:ss.SSS');
		
		const filename = `${settings.folderPath}/${timestampStr}.md`;
		
		const tags = this.extractTags(text);
		const tagsYaml = tags.length > 0 ? `tags: [${tags.join(', ')}]\n` : 'tags: []\n';
		
		let customPropsYaml = '';
		if (settings.customProperties && settings.customProperties.trim().length > 0) {
			customPropsYaml = settings.customProperties.trim() + '\n';
		}
		
		const fileContent = `---
created: ${createdStr}
${tagsYaml}${customPropsYaml}---
${text}
`;

		return await app.vault.create(filename, fileContent);
	}

	static async deletePebble(app: App, file: TFile): Promise<void> {
		await app.vault.delete(file);
	}

	static getPebbles(app: App, settings: PebbleSettings): PebbleMetadata[] {
		const files = app.vault.getMarkdownFiles().filter(f => 
			f.parent?.path === settings.folderPath
		);

		const pebbles: PebbleMetadata[] = [];
		for (const file of files) {
			const p = this.getPebble(app, file);
			if (p) pebbles.push(p);
		}

		pebbles.sort((a, b) => b.created - a.created);
		return pebbles;
	}

	static getPebble(app: App, file: TFile): PebbleMetadata | null {
		const cache = app.metadataCache.getFileCache(file);
		
		let created = file.stat.ctime;
		const createdStr = cache?.frontmatter?.created;
		
		if (createdStr) {
			const parsed = moment(createdStr);
			if (parsed.isValid()) created = parsed.valueOf();
		} else {
			// Fallback: extract from timestamp filename if possible (e.g. 20260612T103200456.md)
			const basename = file.basename;
			if (/^\d{8}T\d{9}$/.test(basename)) {
				const parsed = moment(basename, 'YYYYMMDDTHHmmssSSS');
				if (parsed.isValid()) created = parsed.valueOf();
			}
		}

		let tags: string[] = [];
		if (cache?.frontmatter?.tags) {
			const rawTags = cache.frontmatter.tags;
			if (Array.isArray(rawTags)) {
				tags = rawTags.map(t => String(t));
			} else if (typeof rawTags === 'string') {
				tags = rawTags.split(',').map(t => t.trim());
			}
		}

		return { file, created, tags };
	}
}
