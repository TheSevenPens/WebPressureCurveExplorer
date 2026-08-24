<script>
  import wap0038 from '../../sample-pressure-response/WAP.0038_2025-11-10.json';
  import wap0047 from '../../sample-pressure-response/WAP.0047_2025-11-10.json';
  import wap0050 from '../../sample-pressure-response/WAP.0050_2025-11-10.json';

  export let data = null;
  export let showCurveEffect = true;
  export let onDataChange = () => {};
  export let onShowCurveEffectChange = () => {};

  const SAMPLES = [
    { label: 'WAP.0038 — KP-504E (unit 1)', data: wap0038 },
    { label: 'WAP.0047 — KP-504E (unit 2)', data: wap0047 },
    { label: 'WAP.0050 — KP-504E (unit 3)', data: wap0050 },
  ];

  let fileInputEl;

  // Derived from the loaded data rather than held locally: this toolbar is
  // recreated on every view switch, so local state would come back as -1 and
  // read "Select data" while the chart still showed the loaded sample.
  $: selectedSampleIndex = SAMPLES.findIndex((sample) => sample.data === data);

  function handleSelectChange(event) {
    const value = event.currentTarget.value;
    if (value === 'upload') {
      fileInputEl.click();
      event.currentTarget.value = selectedSampleIndex;
      return;
    }
    const index = parseInt(value, 10);
    if (isNaN(index) || index < 0) {
      clearData();
      return;
    }
    onDataChange(SAMPLES[index].data);
  }

  function clearData() {
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
        onDataChange(parsed);
      } catch {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    event.currentTarget.value = '';
  }
</script>

<span class="info-item">
  Data:
  <select class="toolbar-select" value={selectedSampleIndex} on:change={handleSelectChange}>
    <option value={-1}>Select data</option>
    {#each SAMPLES as sample, i}
      <option value={i}>{sample.label}</option>
    {/each}
    <option value="upload">Upload JSON...</option>
  </select>
</span>
<input
  bind:this={fileInputEl}
  type="file"
  accept=".json"
  style="display: none"
  on:change={handleFileUpload}
/>

{#if data}
  <button id="btn-clear" type="button" on:click={clearData}>Clear</button>

  <label class="info-item checkbox-row">
    <input
      type="checkbox"
      checked={showCurveEffect}
      on:change={(e) => onShowCurveEffectChange(e.currentTarget.checked)}
    />
    Show effect of curve
  </label>

  <span class="info-item response-meta">
    <span class="val">{data.inventoryid}</span>
    {data.brand} {data.pen} · {data.tablet} · {data.date} · {data.records.length} pts
  </span>
{/if}

<style>
  .toolbar-select {
    font-size: 12px;
    padding: 1px 3px;
    max-width: 220px;
  }

  .response-meta {
    color: #666;
    gap: 6px;
  }
</style>
