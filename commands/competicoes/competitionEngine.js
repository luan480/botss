const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'competitions.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');

function ensure() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ competitions: [] }, null, 2));
    if (!fs.existsSync(TEMPLATES_FILE)) fs.writeFileSync(TEMPLATES_FILE, JSON.stringify({ templates: [] }, null, 2));
}

function read(file, fallback) {
    ensure();
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function write(file, value) {
    ensure();
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value, null, 2));
    fs.renameSync(temp, file);
}

function id(prefix = 'cmp') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultCompetition(type = 'personalizado', creatorId = null) {
    return {
        id: id(),
        version: 1,
        type,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: creatorId,
        metadata: {
            name: 'Nova Competição',
            shortName: '',
            subtitle: '',
            description: '',
            season: '',
            edition: '',
            emoji: '🏆',
            tags: [],
            organizer: ''
        },
        visual: {
            color: '#C9A227',
            banner: '',
            thumbnail: '',
            logo: '',
            images: {},
            footer: 'WorldWarBR • Competição'
        },
        registration: {
            enabled: true,
            mode: 'manual',
            minimum: 2,
            maximum: 32,
            reserves: 0,
            teamMode: 'individual',
            questions: []
        },
        participants: [],
        stages: [],
        scoring: {
            rules: [],
            tiebreakers: []
        },
        matches: [],
        customFields: [],
        rules: [],
        rewards: [],
        schedule: [],
        channels: {},
        roles: {},
        panel: {
            title: '',
            description: '',
            buttons: []
        },
        automation: {
            reminders: false,
            matchNotifications: true,
            resultNotifications: true,
            autoWalkover: false
        },
        hallOfFame: {
            enabled: true,
            category: 'eventos',
            image: ''
        },
        audit: [],
        snapshots: []
    };
}

function list() { return read(DATA_FILE, { competitions: [] }).competitions; }
function saveAll(competitions) { write(DATA_FILE, { competitions }); }
function get(idValue) { return list().find(c => c.id === idValue); }

function save(competition, actorId = null, action = 'update') {
    const all = list();
    const index = all.findIndex(c => c.id === competition.id);
    competition.updatedAt = new Date().toISOString();
    competition.version = Number(competition.version || 1) + (index >= 0 ? 1 : 0);
    competition.audit = Array.isArray(competition.audit) ? competition.audit : [];
    competition.audit.push({ at: competition.updatedAt, actorId, action, version: competition.version });
    if (index >= 0) all[index] = competition; else all.push(competition);
    saveAll(all);
    return competition;
}

function snapshot(competition, actorId, reason = 'manual') {
    competition.snapshots = Array.isArray(competition.snapshots) ? competition.snapshots : [];
    competition.snapshots.push({ version: competition.version, at: new Date().toISOString(), actorId, reason, data: JSON.parse(JSON.stringify(competition)) });
    if (competition.snapshots.length > 20) competition.snapshots.shift();
}

function duplicate(source, creatorId) {
    const copy = JSON.parse(JSON.stringify(source));
    copy.id = id();
    copy.version = 1;
    copy.status = 'draft';
    copy.createdBy = creatorId;
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    copy.participants = [];
    copy.matches = [];
    copy.audit = [];
    copy.snapshots = [];
    copy.metadata.name = `${copy.metadata.name || 'Competição'} — Cópia`;
    return save(copy, creatorId, 'duplicate');
}

function addAudit(competition, actorId, action, details = {}) {
    competition.audit = Array.isArray(competition.audit) ? competition.audit : [];
    competition.audit.push({ at: new Date().toISOString(), actorId, action, details });
}

module.exports = { id, defaultCompetition, list, get, save, snapshot, duplicate, addAudit, DATA_FILE, TEMPLATES_FILE };
