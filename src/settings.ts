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
	}
}
