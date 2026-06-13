import { Plugin, WorkspaceLeaf } from 'obsidian';
import { PebbleSettingTab } from './settings';
import { PebbleSettings, DEFAULT_SETTINGS } from './types';
import { PebbleView, PEBBLE_VIEW_TYPE } from './ui/pebble_view';
import { QuickCaptureModal } from './ui/quick_capture_modal';

export default class PebblePlugin extends Plugin {
	settings!: PebbleSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			PEBBLE_VIEW_TYPE,
			(leaf) => new PebbleView(leaf, this)
		);

		this.addRibbonIcon('message-circle', 'Open Pebble', () => {
			this.activateView();
		});

		this.addCommand({
			id: 'open-pebble-quick-capture',
			name: 'Quick Capture',
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "p" }],
			callback: () => {
				new QuickCaptureModal(this.app, this).open();
			}
		});

		this.addSettingTab(new PebbleSettingTab(this.app, this));
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(PEBBLE_VIEW_TYPE);
	}

	async activateView() {
		const { workspace } = this.app;
		
		let leaf: WorkspaceLeaf | undefined;
		const leaves = workspace.getLeavesOfType(PEBBLE_VIEW_TYPE);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
				await leaf.setViewState({ type: PEBBLE_VIEW_TYPE, active: true });
			}
		}

		if (leaf) workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<PebbleSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
