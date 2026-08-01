const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;
const PEER_PREFIX = 'browser-strike-room-';

export function normalizeRoomCode(value = '') {
  return String(value).toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, ROOM_CODE_LENGTH);
}

export function createRoomCode(randomValues) {
  const values = randomValues || (() => {
    const bytes = new Uint8Array(ROOM_CODE_LENGTH);
    globalThis.crypto?.getRandomValues?.(bytes);
    if (!bytes.some(Boolean)) for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
    return bytes;
  })();
  return Array.from(values).slice(0, ROOM_CODE_LENGTH).map((value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join('');
}

export function roomPeerId(code) {
  const normalized = normalizeRoomCode(code);
  return normalized.length === ROOM_CODE_LENGTH ? `${PEER_PREFIX}${normalized.toLowerCase()}` : '';
}

export function cleanPlayerName(value = '') {
  const name = String(value).replace(/[<>]/g, '').trim().replace(/\s+/g, ' ').slice(0, 18);
  return name || 'Игрок';
}

export class OnlineSession extends EventTarget {
  constructor({ PeerClass = globalThis.Peer, storage = globalThis.localStorage } = {}) {
    super();
    this.PeerClass = PeerClass;
    this.storage = storage;
    this.peer = null;
    this.connection = null;
    this.role = null;
    this.code = '';
    this.localName = 'Игрок';
    this.remoteName = 'Друг';
    this.latency = 0;
    this.started = false;
    this.generation = 0;
    this.lastPingAt = 0;
  }

  bindUI() {
    this.elements = {
      name: document.getElementById('online-name'),
      code: document.getElementById('online-room-code'),
      joinCode: document.getElementById('join-room-code'),
      create: document.getElementById('create-room'),
      copy: document.getElementById('copy-room-code'),
      join: document.getElementById('join-room'),
      status: document.getElementById('online-room-status')
    };
    const savedName = cleanPlayerName(this.storage?.getItem?.('browser-strike-online-name') || 'Игрок');
    this.elements.name.value = savedName;
    this.elements.joinCode.addEventListener('input', () => { this.elements.joinCode.value = normalizeRoomCode(this.elements.joinCode.value); });
    this.elements.joinCode.addEventListener('keydown', (event) => { if (event.code === 'Enter') this.joinRoom(); });
    this.elements.create.addEventListener('click', () => this.createRoom());
    this.elements.join.addEventListener('click', () => this.joinRoom());
    this.elements.copy.addEventListener('click', () => this.copyCode());
    return this;
  }

  readName() {
    this.localName = cleanPlayerName(this.elements?.name?.value);
    if (this.elements?.name) this.elements.name.value = this.localName;
    try { this.storage?.setItem?.('browser-strike-online-name', this.localName); } catch {}
    return this.localName;
  }

  peerConstructor() {
    return this.PeerClass || globalThis.Peer;
  }

  createRoom() {
    const Peer = this.peerConstructor();
    if (!Peer) return this.setStatus('Сетевая библиотека не загрузилась. Проверьте интернет и обновите страницу.', 'error');
    this.closeConnection();
    this.readName();
    this.role = 'host';
    this.code = createRoomCode();
    this.started = false;
    this.renderCode();
    this.setBusy(true);
    this.setStatus('Создаём комнату…');
    const token = ++this.generation;
    this.peer = new Peer(roomPeerId(this.code), { debug: 0 });
    this.bindPeer(this.peer, token);
    this.peer.on('open', () => {
      if (token !== this.generation) return;
      this.setStatus(`Комната ${this.code} готова. Ждём второго игрока…`, 'success');
      this.elements.copy.disabled = false;
    });
    this.peer.on('connection', (connection) => {
      if (token !== this.generation) return connection.close();
      if (this.connection?.open || this.started) {
        connection.on('open', () => { connection.send({ type: 'room-full' }); connection.close(); });
        return;
      }
      this.connection = connection;
      this.remoteName = cleanPlayerName(connection.metadata?.name || 'Друг');
      this.bindConnection(connection, token);
    });
  }

  joinRoom() {
    const Peer = this.peerConstructor();
    if (!Peer) return this.setStatus('Сетевая библиотека не загрузилась. Проверьте интернет и обновите страницу.', 'error');
    const code = normalizeRoomCode(this.elements?.joinCode?.value);
    if (code.length !== ROOM_CODE_LENGTH) return this.setStatus('Введите все 6 символов кода комнаты.', 'error');
    this.closeConnection();
    this.readName();
    this.role = 'guest';
    this.code = code;
    this.started = false;
    this.renderCode();
    this.setBusy(true);
    this.setStatus(`Ищем комнату ${code}…`);
    const token = ++this.generation;
    this.peer = new Peer({ debug: 0 });
    this.bindPeer(this.peer, token);
    this.peer.on('open', () => {
      if (token !== this.generation) return;
      const connection = this.peer.connect(roomPeerId(code), { reliable: true, serialization: 'json', metadata: { name: this.localName } });
      this.connection = connection;
      this.bindConnection(connection, token);
    });
  }

  bindPeer(peer, token) {
    peer.on('error', (error) => {
      if (token !== this.generation) return;
      const messages = {
        'peer-unavailable': 'Комната не найдена. Проверьте код и попросите хозяина создать комнату заново.',
        'unavailable-id': 'Такой код уже занят. Нажмите «Создать» ещё раз.',
        network: 'Нет соединения с сервером комнат. Проверьте интернет.',
        'server-error': 'Сервер комнат временно недоступен. Попробуйте ещё раз.'
      };
      this.setStatus(messages[error?.type] || `Ошибка соединения: ${error?.message || 'неизвестная ошибка'}`, 'error');
      this.setBusy(false);
    });
  }

  bindConnection(connection, token) {
    connection.on('open', () => {
      if (token !== this.generation) return connection.close();
      if (this.role === 'host') {
        connection.send({ type: 'match', mode: 'tdm', team: 'defenders', hostName: this.localName });
        this.beginMatch('attackers');
      } else {
        this.setStatus('Соединение установлено. Запускаем матч…', 'success');
      }
    });
    connection.on('data', (message) => this.handleData(message, token));
    connection.on('close', () => {
      if (token !== this.generation) return;
      const wasStarted = this.started;
      this.started = false;
      this.setBusy(false);
      this.setStatus(wasStarted ? 'Второй игрок отключился.' : 'Соединение с комнатой закрыто.', 'error');
      if (wasStarted) this.dispatchEvent(new CustomEvent('disconnected', { detail: { reason: 'Второй игрок отключился' } }));
    });
    connection.on('error', (error) => {
      if (token !== this.generation) return;
      this.setStatus(`Ошибка канала: ${error?.message || 'соединение потеряно'}`, 'error');
    });
  }

  handleData(message, token) {
    if (token !== this.generation || !message || typeof message !== 'object') return;
    if (message.type === 'room-full') {
      this.setStatus('В этой комнате уже играют два человека.', 'error');
      this.setBusy(false);
      return;
    }
    if (message.type === 'match' && this.role === 'guest' && !this.started) {
      this.remoteName = cleanPlayerName(message.hostName || 'Хозяин комнаты');
      this.beginMatch(message.team === 'attackers' ? 'attackers' : 'defenders');
      return;
    }
    if (message.type === 'ping') {
      this.send({ type: 'pong', sentAt: Number(message.sentAt) || 0 });
      return;
    }
    if (message.type === 'pong') {
      this.latency = Math.max(0, Math.round((performance.now() - (Number(message.sentAt) || performance.now())) / 2));
      return;
    }
    this.dispatchEvent(new CustomEvent('message', { detail: message }));
  }

  beginMatch(team) {
    if (this.started) return;
    this.started = true;
    this.setStatus(`Игрок ${this.remoteName} подключён. Матч запускается!`, 'success');
    this.dispatchEvent(new CustomEvent('ready', { detail: { session: this, team, mode: 'tdm' } }));
  }

  updatePing(now = performance.now()) {
    if (!this.started || now - this.lastPingAt < 2000) return;
    this.lastPingAt = now;
    this.send({ type: 'ping', sentAt: now });
  }

  send(message) {
    if (!this.connection?.open) return false;
    try { this.connection.send(message); return true; } catch { return false; }
  }

  async copyCode() {
    if (!this.code) return;
    try {
      await navigator.clipboard.writeText(this.code);
      this.setStatus(`Код ${this.code} скопирован. Отправьте его другу.`, 'success');
    } catch {
      this.setStatus(`Не удалось скопировать автоматически. Код комнаты: ${this.code}`, 'error');
    }
  }

  renderCode() {
    if (this.elements?.code) this.elements.code.textContent = this.code ? this.code.split('').join(' ') : '— — — — — —';
  }

  setBusy(busy) {
    if (!this.elements) return;
    for (const element of [this.elements.name, this.elements.joinCode, this.elements.create, this.elements.join]) element.disabled = busy;
    if (!busy) this.elements.copy.disabled = !this.code;
  }

  setStatus(text, type = '') {
    if (this.elements?.status) {
      this.elements.status.textContent = text;
      this.elements.status.className = `online-status${type ? ` ${type}` : ''}`;
    }
    this.dispatchEvent(new CustomEvent('status', { detail: { text, type } }));
  }

  closeConnection({ resetUI = false } = {}) {
    this.generation++;
    try { this.connection?.close(); } catch {}
    try { this.peer?.destroy(); } catch {}
    this.connection = null;
    this.peer = null;
    this.started = false;
    this.role = null;
    this.latency = 0;
    if (resetUI) {
      this.code = '';
      this.renderCode();
      this.setBusy(false);
      this.setStatus('Создайте комнату или введите код друга');
    }
  }

  disconnect() {
    if (this.connection?.open) this.send({ type: 'leave' });
    this.closeConnection({ resetUI: true });
  }
}
