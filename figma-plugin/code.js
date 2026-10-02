// Lens distortion: takes the selected layer, lets you tune the effect in the plugin window
// and creates a new image layer next to the original. The original is not modified.
figma.showUI(__html__, { width: 360, height: 780, themeColors: true });

const MAX_SIDE = 4096;

function pickNode() {
  const sel = figma.currentPage.selection;
  if (sel.length === 0) return { error: 'Выделите слой или фрейм с изображением.' };
  if (sel.length > 1) return { error: 'Выделено несколько слоёв. Выделите один.' };
  const node = sel[0];
  if (!('exportAsync' in node) || node.width < 1 || node.height < 1) {
    return { error: 'Этот слой нельзя обработать. Выделите слой или фрейм.' };
  }
  return { node: node };
}

async function sendSelection() {
  const picked = pickNode();
  if (picked.error) {
    figma.ui.postMessage({ type: 'empty', message: picked.error });
    return;
  }
  const node = picked.node;
  const scale = Math.min(2, MAX_SIDE / Math.max(node.width, node.height));
  try {
    const bytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: scale },
    });
    // The selection may have changed while exporting.
    const now = figma.currentPage.selection;
    if (now.length !== 1 || now[0].id !== node.id) return;
    figma.ui.postMessage({ type: 'image', bytes: bytes, name: node.name, width: node.width, height: node.height });
  } catch (e) {
    figma.ui.postMessage({ type: 'empty', message: 'Не удалось получить изображение слоя.' });
  }
}

figma.on('selectionchange', sendSelection);

figma.ui.onmessage = function (msg) {
  if (msg.type === 'ready') {
    sendSelection();
  } else if (msg.type === 'apply') {
    const picked = pickNode();
    if (picked.error) {
      figma.notify(picked.error);
      figma.ui.postMessage({ type: 'applied' });
      return;
    }
    const node = picked.node;
    const image = figma.createImage(msg.bytes);
    const rect = figma.createRectangle();
    rect.name = 'Lens distortion – ' + node.name;
    rect.resize(node.width, node.height);
    rect.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
    const parent = node.parent;
    if (parent && 'appendChild' in parent) parent.appendChild(rect);
    rect.x = node.x + node.width + 40;
    rect.y = node.y;
    figma.currentPage.selection = [rect];
    figma.viewport.scrollAndZoomIntoView([node, rect]);
    figma.notify('Слой создан рядом с оригиналом');
    figma.ui.postMessage({ type: 'applied' });
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};
