import * as THREE from 'three';
import { MAP_MATERIALS, WorkshopStore, createWorkshopMap, parseWorkshopMap, sanitizeWorkshopMap, serializeWorkshopMap, workshopMapToConfig } from '../map/WorkshopMap.js';
import { createAtlasMaterials } from '../map/MaterialLibrary.js';

export class MapWorkshop extends EventTarget {
  constructor({ storage = globalThis.localStorage } = {}) {
    super();this.store = new WorkshopStore(storage);this.map = null;this.tool = 'select';this.selectedId = null;this.active = false;
    this.objectGroup = new THREE.Group();this.raycaster = new THREE.Raycaster();this.pointer = new THREE.Vector2();this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.cameraAngle = Math.PI * .25;this.cameraPitch = .86;this.zoom = 1;this.dragging = false;
  }

  bindUI() {
    this.elements = {
      viewport: document.getElementById('builder-viewport'), library: document.getElementById('workshop-library'), status: document.getElementById('builder-status'),
      name: document.getElementById('builder-map-name'), author: document.getElementById('builder-author'), floor: document.getElementById('builder-floor'),
      width: document.getElementById('builder-width'), depth: document.getElementById('builder-depth'), objectWidth: document.getElementById('builder-object-width'),
      objectDepth: document.getElementById('builder-object-depth'), objectHeight: document.getElementById('builder-object-height'), material: document.getElementById('builder-material'), rampDirection: document.getElementById('builder-ramp-direction'),
      importFile: document.getElementById('workshop-import-file')
    };
    for (const [id, label] of Object.entries(MAP_MATERIALS)) {
      for (const select of [this.elements.floor, this.elements.material]) { const option = document.createElement('option');option.value = id;option.textContent = label;select.append(option); }
    }
    document.querySelectorAll('[data-builder-tool]').forEach((button) => button.addEventListener('click', () => this.selectTool(button.dataset.builderTool)));
    document.getElementById('builder-new').addEventListener('click', () => this.newMap());
    document.getElementById('builder-save').addEventListener('click', () => this.save());
    document.getElementById('builder-export').addEventListener('click', () => this.exportMap(this.map));
    document.getElementById('builder-delete-object').addEventListener('click', () => this.deleteSelected());
    document.getElementById('builder-clear-all').addEventListener('click', () => this.clearAll());
    document.getElementById('builder-update-object').addEventListener('click', () => this.updateSelected());
    document.getElementById('workshop-import').addEventListener('click', () => this.elements.importFile.click());
    this.elements.importFile.addEventListener('change', (event) => this.importFile(event.target.files?.[0]));
    for (const element of [this.elements.name, this.elements.author, this.elements.floor, this.elements.width, this.elements.depth]) element.addEventListener('change', () => this.updateMapFields());
    this.setupRenderer();this.renderLibrary();this.newMap(false);return this;
  }

  setupRenderer() {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });this.renderer.outputColorSpace = THREE.SRGBColorSpace;this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;
      this.elements.viewport.append(this.renderer.domElement);this.scene = new THREE.Scene();this.scene.background = new THREE.Color(0x17201b);
      this.camera = new THREE.PerspectiveCamera(48, 1, .1, 2000);this.scene.add(new THREE.HemisphereLight(0xe6f1ff, 0x263128, 2.2));
      const sun = new THREE.DirectionalLight(0xffe3ae, 3);sun.position.set(-30, 60, 25);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);this.scene.add(sun);this.scene.add(this.objectGroup);
      this.renderer.domElement.addEventListener('pointerdown', (event) => this.onPointerDown(event));
      this.renderer.domElement.addEventListener('pointermove', (event) => this.onPointerMove(event));
      window.addEventListener('pointerup', () => { this.dragging = false; });
      this.renderer.domElement.addEventListener('wheel', (event) => { event.preventDefault();this.zoom = THREE.MathUtils.clamp(this.zoom + Math.sign(event.deltaY) * .1, .55, 2.1);this.updateCamera(); }, { passive: false });
      this.renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
      this.resizeObserver = new ResizeObserver(() => this.resize());this.resizeObserver.observe(this.elements.viewport);
    } catch (error) { this.setStatus('3D-редактор недоступен в этом браузере', 'error');console.error(error); }
  }

  onScreen(id) {
    this.active = id === 'workshop-menu';
    if (!this.active) { this.renderer?.setAnimationLoop(null);return; }
    if (!this.materialLibrary) { this.materialLibrary=createAtlasMaterials({anisotropy:4});this.editorMaterials=this.materialLibrary.materials; }
    this.resize();this.renderLibrary();this.rebuildScene();this.renderWorkshop??=()=>this.renderer.render(this.scene,this.camera);this.renderer.setAnimationLoop(this.renderWorkshop);
  }

  newMap(showStatus = true) {
    this.map = createWorkshopMap({ author: this.elements.author.value || 'Игрок' });this.selectedId = null;this.syncFields();this.rebuildScene();if (showStatus) this.setStatus('Создан новый черновик карты');
  }

  edit(map) { this.map = sanitizeWorkshopMap(map);this.selectedId = null;this.syncFields();this.rebuildScene();this.setStatus(`Редактирование: ${this.map.name}`); }

  syncFields() {
    if (!this.map) return;this.elements.name.value = this.map.name;this.elements.author.value = this.map.author;this.elements.floor.value = this.map.floorMaterial;
    this.elements.width.value = this.map.size.width;this.elements.depth.value = this.map.size.depth;
  }

  updateMapFields() {
    if (!this.map) return;this.map = sanitizeWorkshopMap({ ...this.map, name: this.elements.name.value, author: this.elements.author.value, floorMaterial: this.elements.floor.value, size: { width: this.elements.width.value, depth: this.elements.depth.value } });
    this.syncFields();this.rebuildScene();
  }

  selectTool(tool) {
    this.tool = tool;document.querySelectorAll('[data-builder-tool]').forEach((button) => button.classList.toggle('selected', button.dataset.builderTool === tool));
    if(tool==='ramp'&&!this.selectedId){this.elements.objectWidth.value=7;this.elements.objectDepth.value=14;this.elements.objectHeight.value=6;this.elements.material.value='concrete';}
    this.setStatus({ select: 'Выберите объект на карте', wall: 'Кликните по сетке, чтобы поставить стену', crate: 'Кликните по сетке, чтобы поставить ящик', ramp: 'Кликните по сетке, чтобы поставить проходимую рампу', attacker: 'Укажите появление террористов', defender: 'Укажите появление спецназа', siteA: 'Укажите центр точки A', siteB: 'Укажите центр точки B', erase: 'Кликните по объекту для удаления' }[tool] || 'Инструмент выбран');
  }

  onPointerDown(event) {
    if (event.button === 2) { this.dragging = true;this.dragStart = { x: event.clientX, angle: this.cameraAngle };return; }
    if (event.button !== 0 || !this.map) return;
    const hitObject = this.pickObject(event);
    if (this.tool === 'erase') { if (hitObject) { this.map.objects = this.map.objects.filter((object) => object.id !== hitObject.userData.mapObjectId);this.selectedId = null;this.rebuildScene(); }return; }
    if (this.tool === 'select') { this.selectObject(hitObject?.userData?.mapObjectId || null);return; }
    const point = this.groundPoint(event);if (!point) return;const x = Math.round(point.x), z = Math.round(point.z);
    if (['wall','crate','ramp'].includes(this.tool)) {
      const object = { id: `object-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, type: this.tool, x, z, w: Number(this.elements.objectWidth.value), d: Number(this.elements.objectDepth.value), h: Number(this.elements.objectHeight.value), material: this.elements.material.value, ...(this.tool==='ramp'?{direction:this.elements.rampDirection.value}:{}) };
      this.map = sanitizeWorkshopMap({ ...this.map, objects: [...this.map.objects, object] });this.selectedId = object.id;
    } else if (this.tool === 'attacker') this.map.attackerSpawn = { x, z };
    else if (this.tool === 'defender') this.map.defenderSpawn = { x, z };
    else if (this.tool === 'siteA' || this.tool === 'siteB') { const id = this.tool === 'siteA' ? 'A' : 'B';this.map.bombSites = this.map.bombSites.map((site) => site.id === id ? { ...site, x, z } : site); }
    this.map = sanitizeWorkshopMap(this.map);this.rebuildScene();
  }

  onPointerMove(event) { if (!this.dragging) return;this.cameraAngle = this.dragStart.angle + (event.clientX - this.dragStart.x) * .009;this.updateCamera(); }

  normalizedPointer(event) { const rect = this.renderer.domElement.getBoundingClientRect();this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);this.raycaster.setFromCamera(this.pointer, this.camera); }
  groundPoint(event) { this.normalizedPointer(event);const point = new THREE.Vector3();return this.raycaster.ray.intersectPlane(this.groundPlane, point) ? point : null; }
  pickObject(event) { this.normalizedPointer(event);return this.raycaster.intersectObjects(this.objectGroup.children, true).find((hit) => hit.object.userData.mapObjectId)?.object || null; }

  selectObject(id) {
    this.selectedId = id;const object = this.map.objects.find((item) => item.id === id);
    if (object) { this.elements.objectWidth.value = object.w;this.elements.objectDepth.value = object.d;this.elements.objectHeight.value = object.h;this.elements.material.value = object.material;if(object.type==='ramp')this.elements.rampDirection.value=object.direction;this.setStatus(`Выбран объект ${{wall:'«стена»',crate:'«ящик»',ramp:'«рампа»'}[object.type]}`); }
    this.rebuildScene();
  }

  updateSelected() {
    const object = this.map?.objects.find((item) => item.id === this.selectedId);if (!object) return this.setStatus('Сначала выберите стену или ящик', 'error');
    Object.assign(object, { w: Number(this.elements.objectWidth.value), d: Number(this.elements.objectDepth.value), h: Number(this.elements.objectHeight.value), material: this.elements.material.value, ...(object.type==='ramp'?{direction:this.elements.rampDirection.value}:{}) });
    this.map = sanitizeWorkshopMap(this.map);this.rebuildScene();this.setStatus('Размер и материал объекта обновлены', 'success');
  }

  deleteSelected() { if (!this.selectedId) return this.setStatus('Сначала выберите объект', 'error');this.map.objects = this.map.objects.filter((object) => object.id !== this.selectedId);this.selectedId = null;this.rebuildScene(); }

  clearAll() { if (!this.map?.objects.length) return this.setStatus('Карта уже пустая');if (!globalThis.confirm?.('Удалить со сцены все стены, ящики и рампы?')) return;this.map = sanitizeWorkshopMap({ ...this.map, objects: [] });this.selectedId = null;this.rebuildScene();this.setStatus('Все объекты карты удалены', 'success'); }

  rebuildScene() {
    if (!this.scene || !this.map || !this.editorMaterials) return;
    for (const child of [...this.objectGroup.children]) { this.objectGroup.remove(child);child.traverse((object) => { object.geometry?.dispose?.();if(object.userData.workshopOwnedMaterial){if(Array.isArray(object.material))object.material.forEach((material)=>material.dispose?.());else object.material?.dispose?.();} }); }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(this.map.size.width, this.map.size.depth), this.editorMaterials[this.map.floorMaterial] || this.editorMaterials.ground);floor.rotation.x = -Math.PI / 2;floor.position.y = -.02;floor.receiveShadow=true;this.objectGroup.add(floor);
    const grid = new THREE.GridHelper(Math.max(this.map.size.width, this.map.size.depth), Math.round(Math.max(this.map.size.width, this.map.size.depth) / 4), 0x8eaa70, 0x405044);grid.position.y = .015;grid.userData.workshopOwnedMaterial=true;this.objectGroup.add(grid);
    for (const object of this.map.objects) {
      const material = this.editorMaterials[object.material] || this.editorMaterials.concrete;
      let mesh;if(object.type==='ramp'){const alongX=object.direction==='east'||object.direction==='west';const run=alongX?object.w:object.d;const length=Math.hypot(run,object.h);mesh=new THREE.Mesh(new THREE.BoxGeometry(alongX?length:object.w,.28,alongX?object.d:length),material);const angle=Math.atan2(object.h,run);if(alongX)mesh.rotation.z=object.direction==='east'?angle:-angle;else mesh.rotation.x=object.direction==='north'?angle:-angle;}else mesh=new THREE.Mesh(new THREE.BoxGeometry(object.w, object.h, object.d), material);mesh.position.set(object.x, object.h / 2, object.z);mesh.userData.mapObjectId = object.id;mesh.castShadow = mesh.receiveShadow = true;this.objectGroup.add(mesh);
      if(object.id===this.selectedId){const outline=new THREE.BoxHelper(mesh,0xaeea72);outline.userData.mapObjectId=object.id;outline.raycast=()=>{};this.objectGroup.add(outline);}
    }
    this.addMarker(this.map.attackerSpawn, 0xe59b43, 'T');this.addMarker(this.map.defenderSpawn, 0x4aa6d8, 'CT');
    for (const site of this.map.bombSites) this.addMarker(site, site.id === 'A' ? 0xe26043 : 0xe4b248, site.id, true);
    this.renderer.shadowMap.needsUpdate=true;this.updateCamera();this.resize();
  }

  addMarker(point, color, name, ring = false) {
    const geometry = ring ? new THREE.TorusGeometry(point.radius || 6, .25, 8, 32) : new THREE.CylinderGeometry(0, 1.25, 3.5, 8);
    const marker = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .82 }));marker.name = name;marker.userData.workshopOwnedMaterial=true;marker.position.set(point.x, ring ? .05 : 1.75, point.z);if (ring) marker.rotation.x = Math.PI / 2;this.objectGroup.add(marker);
  }

  updateCamera() {
    if (!this.camera || !this.map) return;const radius = Math.max(this.map.size.width, this.map.size.depth) * .82 * this.zoom;
    this.camera.position.set(Math.sin(this.cameraAngle) * radius, radius * this.cameraPitch, Math.cos(this.cameraAngle) * radius);this.camera.lookAt(0, 0, 0);
  }

  resize() { if (!this.renderer || !this.camera) return;const width = this.elements.viewport.clientWidth || 700, height = this.elements.viewport.clientHeight || 500;this.renderer.setSize(width, height, false);this.camera.aspect = width / height;this.camera.updateProjectionMatrix(); }

  save() { this.updateMapFields();this.map = this.store.save(this.map);this.renderLibrary();this.setStatus(`Карта «${this.map.name}» сохранена в мастерской`, 'success'); }

  use(map) { const clean = sanitizeWorkshopMap(map);this.dispatchEvent(new CustomEvent('selected', { detail: { map: clean, config: workshopMapToConfig(clean) } }));this.setStatus(`Выбрана карта «${clean.name}»`, 'success'); }

  exportMap(map) {
    if (!map) return;const clean = sanitizeWorkshopMap(map);const blob = new Blob([serializeWorkshopMap(clean)], { type: 'application/json' });const url = URL.createObjectURL(blob);
    const link = document.createElement('a');link.href = url;link.download = `${clean.name.replace(/[^а-яa-z0-9_-]+/gi, '-') || 'browser-strike-map'}.json`;link.click();setTimeout(() => URL.revokeObjectURL(url), 1000);this.setStatus('Файл карты готов — его можно отправить другу', 'success');
  }

  async importFile(file) {
    if (!file) return;if (file.size > 2_000_000) return this.setStatus('Файл карты слишком большой', 'error');
    try { const map = this.store.save(parseWorkshopMap(await file.text()));this.edit(map);this.renderLibrary();this.setStatus(`Карта «${map.name}» импортирована`, 'success'); }
    catch (error) { this.setStatus(error.message || 'Не удалось импортировать карту', 'error'); }
    finally { this.elements.importFile.value = ''; }
  }

  renderLibrary() {
    if (!this.elements?.library) return;const maps = this.store.list();this.elements.library.replaceChildren();
    if (!maps.length) { const empty = document.createElement('p');empty.className = 'workshop-empty';empty.textContent = 'Сохранённых карт пока нет';this.elements.library.append(empty);return; }
    for (const map of maps) {
      const card = document.createElement('article');card.className = 'workshop-map-card';
      const info = document.createElement('div');const title = document.createElement('strong');title.textContent = map.name;const meta = document.createElement('small');meta.textContent = `${map.author} · ${map.objects.length} объектов · ${map.size.width}×${map.size.depth}`;info.append(title, meta);
      const actions = document.createElement('div');
      const button = (label, action, className = '') => { const element = document.createElement('button');element.textContent = label;element.className = className;element.addEventListener('click', action);return element; };
      actions.append(button('Выбрать', () => this.use(map), 'accent'), button('Изменить', () => this.edit(map)), button('Файл', () => this.exportMap(map)), button('Удалить', () => { if (!globalThis.confirm?.(`Удалить карту «${map.name}» из локальной мастерской?`)) return;this.store.remove(map.id);this.renderLibrary(); }, 'danger'));
      card.append(info, actions);this.elements.library.append(card);
    }
  }

  setStatus(text, type = '') { if (!this.elements?.status) return;this.elements.status.textContent = text;this.elements.status.className = `status-line${type ? ` ${type}` : ''}`; }
}
