import { App, Modal, Notice } from 'obsidian';
import { PebbleManager } from '../utils/pebble_manager';
import type PebblePlugin from '../main';
import { handleListContinuation } from '../utils/editor_helpers';

export class QuickCaptureModal extends Modal {
	plugin: PebblePlugin;
	textarea!: HTMLTextAreaElement;

	constructor(app: App, plugin: PebblePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('pebble-quick-capture-modal');

		this.textarea = contentEl.createEl('textarea', {
			cls: 'pebble-capture-textarea',
			attr: {
				placeholder: "Drop a new pebble...",
				rows: "3"
			}
		});

		this.textarea.addEventListener('input', function() {
			const oldScrollTop = this.scrollTop;
			this.style.height = 'auto';
			this.style.height = this.scrollHeight + 'px';
			if (this.selectionStart === this.value.length) {
				this.scrollTop = this.scrollHeight;
			} else {
				this.scrollTop = oldScrollTop;
			}
		});

		const controlsEl = contentEl.createDiv('pebble-capture-controls');
		
		const rightControls = controlsEl.createDiv('pebble-capture-right-controls');
		
		const saveBtn = rightControls.createEl('button', { cls: 'pebble-save-btn' });
		saveBtn.innerHTML = `
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
		`;
		
		saveBtn.onclick = () => this.savePebble();

		this.textarea.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				this.savePebble();
				return;
			}
			
			if (handleListContinuation(this.textarea, e)) {
				this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
				return;
			}
		});

		setTimeout(() => {
			this.textarea.focus();
		}, 100);
	}

	async savePebble() {
		const text = this.textarea.value.trim();
		if (!text) {
			new Notice('Pebble is empty!');
			return;
		}
		
		try {
			await PebbleManager.savePebble(this.app, this.plugin.settings, text);
			new Notice('Pebble saved');
			this.textarea.style.height = 'auto'; // Reset height
			this.close();
		} catch (e) {
			console.error(e);
			new Notice('Failed to save pebble');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
