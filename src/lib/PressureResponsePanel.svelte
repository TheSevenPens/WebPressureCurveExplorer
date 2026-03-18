<script>
  import wap0038 from '../../sample-pressure-response/WAP.0038_2025-11-10.json';
  import wap0047 from '../../sample-pressure-response/WAP.0047_2025-11-10.json';
  import wap0050 from '../../sample-pressure-response/WAP.0050_2025-11-10.json';

  export let onDataChange = () => {};

  const SAMPLES = [
    { label: 'WAP.0038 — KP-504E (unit 1)', data: wap0038 },
    { label: 'WAP.0047 — KP-504E (unit 2)', data: wap0047 },
    { label: 'WAP.0050 — KP-504E (unit 3)', data: wap0050 },
  ];

  let isOpen = false;
  let loadedData = null;
  let fileInputEl;
  let selectedSampleIndex = -1;

  function toggle() {
    isOpen = !isOpen;
  }

  function loadSample(event) {
    const index = parseInt(event.currentTarget.value, 10);
    selectedSampleIndex = index;
    if (isNaN(index) || index < 0) {
      clearData();
      return;
    }
    loadedData = SAMPLES[index].data;
    onDataChange(loadedData);
  }

  function clearData() {
    loadedData = null;
    selectedSampleIndex = -1;
    onDataChange(null);
  }

  function handleFileUpload(event) {
    const file = event.currentTarget.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!Array.isArray(parsed.records) || parsed.records.length === 0) {
          alert('Invalid file: missing or empty "records" array.');
          return;
        }
        selectedSampleIndex = -1;
        loadedData = parsed;
        onDataChange(loadedData);
      } catch {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    event.currentTarget.value = '';
  }
</script>

<div class="response-panel">
  <button class="response-toggle" type="button" on:click={toggle}>
    Pressure Response {isOpen ? '▴' : '▾'}
  </button>

  {#if isOpen}
    <div class="response-controls">
      <select value={selectedSampleIndex} on:change={loadSample}>
        <option value={-1}>— sample data —</option>
        {#each SAMPLES as sample, i}
          <option value={i}>{sample.label}</option>
        {/each}
      </select>

      <div class="response-row">
        <button
          type="button"
          class="small-action-btn"
          on:click={() => fileInputEl.click()}
        >
          Upload JSON
        </button>
        <input
          bind:this={fileInputEl}
          type="file"
          accept=".json"
          style="display: none"
          on:change={handleFileUpload}
        />
        {#if loadedData}
          <button type="button" class="small-action-btn" on:click={clearData}>Clear</button>
        {/if}
      </div>

      {#if loadedData}
        <div class="response-info">
          <span class="response-info-id">{loadedData.inventoryid} — {loadedData.brand} {loadedData.pen}</span>
          <span>{loadedData.tablet} · {loadedData.date} · {loadedData.records.length} pts</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .response-panel {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #e0e0e8;
  }

  .response-toggle {
    background: none;
    border: none;
    padding: 0;
    font-size: 11px;
    color: #666;
    cursor: pointer;
    font-family: inherit;
    width: 100%;
    text-align: left;
  }

  .response-toggle:hover {
    color: #222;
  }

  .response-controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 6px;
  }

  .response-controls select {
    width: 100%;
    font-size: 11px;
    padding: 2px 4px;
    font-family: inherit;
  }

  .response-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .small-action-btn {
    font-size: 11px;
    padding: 2px 7px;
    cursor: pointer;
  }

  .response-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-size: 10px;
    color: #888;
    background: #f5f5f8;
    border-left: 2px solid #cc6600;
    border-radius: 0 3px 3px 0;
    padding: 4px 6px;
  }

  .response-info-id {
    color: #555;
    font-weight: bold;
  }
</style>
