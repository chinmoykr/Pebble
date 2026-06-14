import { App, PluginSettingTab, Setting } from 'obsidian';
import type PebblePlugin from './main';

export class PebbleSettingTab extends PluginSettingTab {
	plugin: PebblePlugin;

	constructor(app: App, plugin: PebblePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Pebbles folder path')
			.setDesc('Where your fleeting thoughts will be saved. Will be created if it does not exist.')
			.addText(text => text
				.setPlaceholder('Pebbles')
				.setValue(this.plugin.settings.folderPath)
				.onChange(async (value) => {
					this.plugin.settings.folderPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Cards per page')
			.setDesc('How many pebbles to load per page scroll in the feed.')
			.addText(text => text
				.setPlaceholder('20')
				.setValue(String(this.plugin.settings.cardsPerPage))
				.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed) && parsed > 0) {
						this.plugin.settings.cardsPerPage = parsed;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Attachment folder path')
			.setDesc('Folder for images and PDFs. Leave this blank to use Obsidian\'s default attachment settings.')
			.addText(text => text
				.setPlaceholder('Pebbles/Attachments')
				.setValue(this.plugin.settings.attachmentFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.attachmentFolderPath = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Custom properties')
			.setDesc('Add custom YAML properties to every new pebble (one per line).')
			.addTextArea(text => text
				.setPlaceholder('type: pebble\nstatus: active')
				.setValue(this.plugin.settings.customProperties)
				.onChange(async (value) => {
					this.plugin.settings.customProperties = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Note-review integration')
			.setDesc('Enable note-review integration to add specific properties when checking the note-review box.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.noteReviewIntegration)
				.onChange(async (value) => {
					this.plugin.settings.noteReviewIntegration = value;
					await this.plugin.saveSettings();
					this.display(); // re-render to show/hide the text area
				}));

		if (this.plugin.settings.noteReviewIntegration) {
			new Setting(containerEl)
				.setName('Note-review properties')
				.setDesc('Properties to append when note-review is checked for a new pebble (one per line).')
				.addTextArea(text => text
					.setPlaceholder('review-status: pending\nnext-review: 2026-06-15')
					.setValue(this.plugin.settings.noteReviewProperties)
					.onChange(async (value) => {
						this.plugin.settings.noteReviewProperties = value;
						await this.plugin.saveSettings();
					}));
		}
	}
}
