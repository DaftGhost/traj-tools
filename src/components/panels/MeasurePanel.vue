<template>
  <div class="panel-view" data-panel="measure">
    <section class="panel-section">
      <div class="measure-controls">
        <button id="toggle-measure" class="btn btn-primary">开启测距</button>
        <button id="clear-measure" class="btn" disabled>清除</button>
      </div>
    </section>

    <section class="panel-section">
      <label class="checkbox-row">
        <input id="measure-snap-enabled" type="checkbox" checked />
        <span>吸附到航线</span>
      </label>
      <label class="checkbox-row">
        <input id="measure-snap-selected-only" type="checkbox" checked />
        <span>仅选中航线</span>
      </label>
    </section>

    <section class="panel-section">
      <div class="measure-result" id="measure-result">点击地图开始测距</div>
    </section>
  </div>
</template>
