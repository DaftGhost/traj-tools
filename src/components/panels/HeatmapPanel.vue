<template>
  <div class="panel-view" data-panel="heatmap">
    <section class="panel-section">
      <h3>热力图设置</h3>
      <p class="hint">为选中航线显示热力分布</p>
    </section>

    <section class="panel-section">
      <label class="checkbox-row">
        <input id="heatmap-enabled" type="checkbox" />
        <span>启用热力图</span>
      </label>
    </section>

    <section class="panel-section">
      <div class="heatmap-control">
        <label>半径: <span id="heatmap-radius-value">25</span>px</label>
        <input id="heatmap-radius" type="range" min="10" max="100" value="25" />
      </div>
      <div class="heatmap-control">
        <label>模糊度: <span id="heatmap-blur-value">15</span>px</label>
        <input id="heatmap-blur" type="range" min="5" max="50" value="15" />
      </div>
      <div class="heatmap-control">
        <label>最小透明度: <span id="heatmap-opacity-value">0.1</span></label>
        <input id="heatmap-opacity" type="range" min="1" max="50" value="10" />
      </div>
    </section>

    <section class="panel-section">
      <label>渐变色</label>
      <select id="heatmap-gradient">
        <option value="default">默认 (蓝-绿-红)</option>
        <option value="fire">火焰 (黄-橙-红)</option>
        <option value="cold">冷色 (蓝-青-白)</option>
        <option value="grayscale">灰度</option>
      </select>
    </section>

    <section class="panel-section">
      <label class="checkbox-label">
        <input id="heatmap-hide-route" type="checkbox" />
        <span>开启热力图时隐藏航线</span>
      </label>
    </section>

    <section class="panel-section">
      <div class="heatmap-preview" id="heatmap-preview"></div>
    </section>
  </div>
</template>
