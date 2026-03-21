<template>
  <div class="panel-view" data-panel="edit">
    <section class="panel-section">
      <div class="edit-controls">
        <button id="toggle-edit" class="btn btn-primary">开启编辑</button>
        <button id="add-node" class="btn">添加节点</button>
        <button id="delete-node" class="btn">删除节点</button>
      </div>
      <div id="endpoint-quick-controls" class="endpoint-quick-controls" hidden>
        <button id="select-start-endpoint" class="btn btn-xs" type="button">开头节点</button>
        <button id="select-end-endpoint" class="btn btn-xs" type="button">末尾节点</button>
      </div>
    </section>

    <section class="panel-section">
      <div class="new-route-control">
        <button id="new-route" class="btn btn-success">新建航线</button>
        <button id="new-polygon" class="btn btn-success">新建多边形</button>
        <button id="add-hole" class="btn">添加孔洞</button>
        <button id="merge-routes" class="btn">合并航线</button>
        <button id="fit-bounds" class="btn">重置视图</button>
      </div>
    </section>

    <section class="panel-section panel-section-smooth">
      <div class="panel-subsection-header" data-toggle="smooth">
        <span>平滑半径</span>
        <span class="toggle-icon">&#9654;</span>
      </div>
      <div class="panel-subsection-content" id="smooth-content">
        <div class="smooth-input-row">
          <input
            id="smooth-radius"
            type="number"
            min="1"
            max="10000"
            value="20"
            class="smooth-number-input"
          />
          <span class="smooth-unit">m</span>
        </div>
        <div class="smooth-actions">
          <button class="btn-xs" id="smooth-plus-1">+1m</button>
          <button class="btn-xs" id="smooth-plus-100">+100m</button>
          <button class="btn-xs" id="smooth-minus-1">-1m</button>
          <button class="btn-xs" id="smooth-minus-100">-100m</button>
        </div>
        <div id="smooth-radius-km" class="smooth-km-display"></div>
      </div>
    </section>
  </div>
</template>
