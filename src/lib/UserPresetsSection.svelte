<script>
  import { loadPresets, persistPresets, upsertPreset, removePreset, findPreset } from './userPresets';

  export let params;

  let userPresets = loadPresets();
  let showSaveDialog = false;
  let savePresetName = '';
  let pendingLoadPreset = null;

  function closeSaveDialog() {
    showSaveDialog = false;
    savePresetName = '';
  }

  function handleSaveDialogKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeSaveDialog();
    }
  }

  function savePreset() {
    const name = savePresetName.trim();
    if (!name) return;
    userPresets = upsertPreset(userPresets, name, params);
    persistPresets(userPresets);
    closeSaveDialog();
  }

  function applyLoadPreset() {
    const preset = findPreset(userPresets, pendingLoadPreset);
    if (preset) params = { ...preset.params };
    pendingLoadPreset = null;
  }

  function deletePreset(name) {
    userPresets = removePreset(userPresets, name);
    persistPresets(userPresets);
  }
</script>

{#if pendingLoadPreset}
  <div class="preset-confirm">
    Load "{pendingLoadPreset}"? This will replace all current settings.
    <div class="preset-confirm-buttons">
      <button type="button" class="small-action-btn" on:click={applyLoadPreset}>Yes</button>
      <button type="button" class="small-action-btn" on:click={() => pendingLoadPreset = null}>Cancel</button>
    </div>
  </div>
{/if}

{#if userPresets.length > 0}
  <div class="preset-list">
    {#each userPresets as preset}
      <div class="preset-item">
        <button type="button" class="preset-load-btn" on:click={() => pendingLoadPreset = preset.name}>
          {preset.name}
        </button>
        <button type="button" class="preset-delete-btn" on:click={() => deletePreset(preset.name)}>✕</button>
      </div>
    {/each}
  </div>
{:else}
  <div class="preset-empty">No saved presets</div>
{/if}

<button type="button" class="small-action-btn" on:click={() => showSaveDialog = true}>Save settings</button>

{#if showSaveDialog}
  <!-- A backdrop has no keyboard equivalent; Escape on the dialog is the
       keyboard route out, handled below. -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="preset-dialog-overlay" on:click|self={closeSaveDialog}>
    <div
      class="preset-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-dialog-title"
      tabindex="-1"
      on:keydown={handleSaveDialogKeyDown}
    >
      <div class="preset-dialog-title" id="preset-dialog-title">Save preset</div>
      <input
        type="text"
        class="preset-name-input"
        placeholder="Preset name"
        bind:value={savePresetName}
        on:keydown={(e) => { if (e.key === 'Enter') savePreset(); }}
      />
      <div class="preset-dialog-buttons">
        <button type="button" class="small-action-btn" on:click={savePreset}>Save</button>
        <button type="button" class="small-action-btn" on:click={closeSaveDialog}>Cancel</button>
      </div>
    </div>
  </div>
{/if}
