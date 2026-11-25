/** Google Sheets → shared schedule sync. Configure Script Properties before running setupSync(). */
const SOURCE_TABLE = 'shared_schedule_source';
const SCHEDULE_TABLE = 'shared_schedule_files';

function setupSync() {
  getConfig_();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncSchedule')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncSchedule').timeBased().everyMinutes(1).create();
  syncSchedule();
}

function syncSchedule() {
  const cfg = getConfig_();
  const rows = api_('GET', SOURCE_TABLE + '?id=eq.1&select=*');
  if (!rows.length) return;
  const source = rows[0];
  const file = DriveApp.getFileById(source.file_id);
  const modified = file.getLastUpdated();
  const modifiedIso = modified.toISOString();
  const forced = source.refresh_requested_at &&
    (!source.last_synced_at || new Date(source.refresh_requested_at) > new Date(source.last_synced_at));
  if (!forced && source.last_modified && new Date(source.last_modified).getTime() === modified.getTime()) return;

  try {
    const spreadsheet = SpreadsheetApp.openById(source.file_id);
    const parsed = {};
    const sheet = spreadsheet.getSheets()[0];
    if (!sheet) throw new Error('У таблиці немає аркушів.');
    const grid = parseGrid_(sheet.getDataRange().getValues());
    if (grid && grid.dates.length) {
      parsed[grid.dates[0].slice(0, 7)] = grid;
      Logger.log('Reading first sheet "%s": %s people', sheet.getName(), grid.people.length);
    }
    const months = Object.keys(parsed);
    if (!months.length) throw new Error('Не знайдено таблицю змін: потрібні дати у заголовку та імена у стовпці C.');

    const loadedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM HH:mm');
    const payload = months.map(month => ({
      month: month,
      name: file.getName(),
      loaded_at: loadedAt,
      hidden: false,
      deleted: false,
      data: parsed[month],
      source_url: source.source_url,
      source_file_id: source.file_id,
      updated_by: null,
      updated_at: new Date().toISOString()
    }));
    api_('POST', SCHEDULE_TABLE + '?on_conflict=month', payload, 'resolution=merge-duplicates');

    // Retire months previously imported from this source but no longer present in the workbook.
    const existing = api_('GET', SCHEDULE_TABLE + '?source_file_id=eq.' + encodeURIComponent(source.file_id) + '&select=month,name,loaded_at,data,source_url,source_file_id');
    const missing = existing.filter(r => months.indexOf(r.month) < 0).map(r => ({
      month: r.month, name: r.name, loaded_at: r.loaded_at, hidden: true, deleted: true,
      data: r.data, source_url: r.source_url, source_file_id: r.source_file_id,
      updated_by: null, updated_at: new Date().toISOString()
    }));
    if (missing.length) api_('POST', SCHEDULE_TABLE + '?on_conflict=month', missing, 'resolution=merge-duplicates');

    api_('PATCH', SOURCE_TABLE + '?id=eq.1', {
      last_modified: modifiedIso,
      last_synced_at: new Date().toISOString(),
      sync_error: null,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    api_('PATCH', SOURCE_TABLE + '?id=eq.1', { sync_error: String(err.message || err).slice(0, 1000), updated_at: new Date().toISOString() });
    throw err;
  }
}

function parseGrid_(rows) {
  let header = -1, cols = [];
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const found = [];
    (rows[r] || []).forEach((v, i) => { if (isDateHeader_(v)) found.push(i); });
    if (found.length >= 20) { header = r; cols = found; break; }
  }
  if (header < 0) return null;
  const dates = cols.map(c => dateYmd_(rows[header][c]));
  const people = [];
  let group = '', isLeader = false;
  for (let r = header + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const name = String(row[2] || '').trim().replace(/^\*+\s*/, '');
    if (!name) continue;
    if (/^(розцінка|кількість|всього|підсумок|разом|примітка)/i.test(name)) break;
    if (/^\*?Керівники груп/i.test(name)) { group = 'Керівники груп'; isLeader = true; continue; }
    if (/^група\s/i.test(name)) { group = name.replace(/\s*\(.*$/, ''); isLeader = false; continue; }
    // Excel imports often contain numeric staff IDs in A/B, but Sheets may
    // return those IDs as text or leave them blank. Keep named rows with an ID
    // or with any actual schedule cell; ignore labels and spacer rows.
    const hasId = [row[0], row[1]].some(v => isNumeric_(v) || (typeof v === 'string' && v.trim() !== ''));
    const hasSchedule = cols.some(c => row.slice(c, c + 4).some(v => v !== null && v !== '' && !(typeof v === 'string' && v.trim() === '')));
    if (!hasId && !hasSchedule) continue;
    const sh = {};
    cols.forEach((c, i) => {
      const cell = parseCell_([row[c], row[c + 1], row[c + 2], row[c + 3]]);
      if (cell) sh[dates[i]] = cell;
    });
    const where = String(row[3] || '').trim();
    const hm = String(row[4] || '').match(/\d+(?:[.,]\d+)?/);
    people.push({ id: name, name: name, group: group || 'Без групи', isLeader: isLeader,
      where: /vpn/i.test(where) ? 'VPN' : (/офіс/i.test(where) ? where : ''),
      hours: hm ? hm[0].replace(',', '.') : '', sh: sh });
  }
  return people.length ? { dates: dates, people: people } : null;
}

function parseCell_(cell) {
  const a = cell[0], b = cell[1], pause = cell[2], d = cell[3];
  const type = typeof d === 'string' ? d.trim() : '';
  const start = time_(a);
  if (start) return { k: 'work', s: start, l: time_(b) || '', b: time_(pause) || '', t: type };
  if (typeof a === 'string') {
    const m = a.trim().match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
    if (m) return { k: 'work', s: m[1].padStart(2, '0') + ':' + m[2], r: m[0].replace(/\s*[-–]\s*/, ' – '), l: time_(b) || '', b: time_(pause) || '', t: type };
  }
  const text = cell.find(v => typeof v === 'string' && v.trim() && v.trim() !== '-');
  if (!text) return null;
  const value = text.trim();
  if (/відпуст/i.test(value)) return { k: 'vac', x: 'Відпустка' };
  if (/лікарн/i.test(value)) return { k: 'sick', x: 'Лікарняний' };
  if (/^вих/i.test(value)) return { k: 'off', x: 'Вихідний' };
  return { k: 'other', x: value };
}

function isDateHeader_(v) {
  if (v instanceof Date) return true;
  return typeof v === 'number' && v > 40000 && v < 60000;
}
function dateYmd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const d = new Date(Math.round((v - 25569) * 86400000));
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}
function time_(v) {
  // Sheet time-only cells arrive as Date values anchored near 1899-12-30.
  // Formatting them in Europe/Kyiv applies the historical +02:02 offset.
  // GMT preserves the displayed clock value (e.g. 13:00 remains 13:00).
  if (v instanceof Date) return Utilities.formatDate(v, 'GMT', 'HH:mm');
  if (typeof v === 'number' && v > 0 && v < 1) {
    const mins = Math.round(v * 1440);
    return String(Math.floor(mins / 60) % 24).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  }
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (m) return m[1].padStart(2, '0') + ':' + m[2];
  }
  return '';
}
function isNumeric_(v) { return typeof v === 'number' && isFinite(v); }
function getConfig_() {
  const p = PropertiesService.getScriptProperties();
  const cfg = { url: (p.getProperty('SUPABASE_URL') || '').replace(/\/$/, ''), key: p.getProperty('SUPABASE_SERVICE_ROLE_KEY') || '' };
  if (!cfg.url || !cfg.key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Apps Script Project Settings → Script Properties.');
  return cfg;
}
function api_(method, path, body, prefer) {
  const cfg = getConfig_();
  const options = { method: method, muteHttpExceptions: true,
    headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, Prefer: prefer || 'return=representation' } };
  if (body !== undefined) { options.contentType = 'application/json'; options.payload = JSON.stringify(body); }
  const response = UrlFetchApp.fetch(cfg.url + '/rest/v1/' + path, options);
  const status = response.getResponseCode(), text = response.getContentText();
  if (status < 200 || status >= 300) throw new Error('Supabase ' + status + ': ' + text);
  return text ? JSON.parse(text) : [];
}
