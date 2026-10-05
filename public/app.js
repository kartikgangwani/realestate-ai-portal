(function () {
  'use strict';

  var currentView = 'dashboard';
  var leadFilter = { search: '', tier: 'ALL', dnc: 'ALL' };
  var csrfToken = '';
  var saveTimer = null;

  var SEED = {
    leads: [
      { id: 'L-001', name: 'Test Lead Aarav', source: 'Simulated Meta form', type: 'Villa', location: 'West Park', budget: 12000000, purpose: 'Investment', timeline: '0–3 months', score: 94, stage: 'Priority review', dnc: false, created: 'Test Day 1' },
      { id: 'L-002', name: 'Test Lead Diya', source: 'Simulated property portal', type: 'Plot', location: 'Green Meadows', budget: 7500000, purpose: 'Personal use', timeline: '0–3 months', score: 88, stage: 'Ready for matching', dnc: false, created: 'Test Day 1' },
      { id: 'L-003', name: 'Test Lead Kabir', source: 'Simulated website form', type: 'Commercial', location: 'Tech Square', budget: 9500000, purpose: 'Investment', timeline: '0–3 months', score: 84, stage: 'Follow-up due', dnc: false, created: 'Test Day 1' },
      { id: 'L-004', name: 'Test Lead Meera', source: 'Simulated manual entry', type: 'Flat', location: 'Lake View', budget: 6800000, purpose: 'Personal use', timeline: '0–3 months', score: 82, stage: 'Visit proposed', dnc: false, created: 'Test Day 1' },
      { id: 'L-005', name: 'Test Lead Ishaan', source: 'Simulated property portal', type: 'Land', location: 'Riverside', budget: 14000000, purpose: 'Investment', timeline: '0–3 months', score: 80, stage: 'Ready for matching', dnc: false, created: 'Test Day 1' },
      { id: 'L-006', name: 'Test Lead Anaya', source: 'Simulated Meta form', type: 'Flat', location: 'Central Avenue', budget: 8500000, purpose: 'Personal use', timeline: '0–3 months', score: 91, stage: 'Priority review', dnc: false, created: 'Test Day 1' },
      { id: 'L-007', name: 'Test Lead Vivaan', source: 'Simulated website form', type: 'Flat', location: 'Lake View', budget: 6200000, purpose: 'Personal use', timeline: '3–6 months', score: 74, stage: 'Follow-up scheduled', dnc: false, created: 'Test Day 1' },
      { id: 'L-008', name: 'Test Lead Tara', source: 'Simulated Meta form', type: 'Villa', location: 'West Park', budget: 11000000, purpose: 'Investment', timeline: '3–6 months', score: 71, stage: 'Nurture', dnc: false, created: 'Test Day 1' },
      { id: 'L-009', name: 'Test Lead Arjun', source: 'Simulated manual entry', type: 'Plot', location: 'Green Meadows', budget: 5200000, purpose: 'Investment', timeline: '3–6 months', score: 67, stage: 'Follow-up scheduled', dnc: false, created: 'Test Day 1' },
      { id: 'L-010', name: 'Test Lead Kiara', source: 'Simulated property portal', type: 'Commercial', location: 'Tech Square', budget: 7900000, purpose: 'Investment', timeline: '6–12 months', score: 63, stage: 'Nurture', dnc: false, created: 'Test Day 1' },
      { id: 'L-011', name: 'Test Lead Rohan', source: 'Simulated website form', type: 'Land', location: 'Riverside', budget: 10000000, purpose: 'Investment', timeline: '6–12 months', score: 59, stage: 'Follow-up scheduled', dnc: false, created: 'Test Day 1' },
      { id: 'L-012', name: 'Test Lead Sana', source: 'Simulated Meta form', type: 'Flat', location: 'Central Avenue', budget: 7200000, purpose: 'Personal use', timeline: '6–12 months', score: 56, stage: 'Nurture', dnc: false, created: 'Test Day 1' },
      { id: 'L-013', name: 'Test Lead Dev', source: 'Simulated manual entry', type: 'Villa', location: 'West Park', budget: 9000000, purpose: 'Personal use', timeline: '6–12 months', score: 53, stage: 'Follow-up scheduled', dnc: false, created: 'Test Day 1' },
      { id: 'L-014', name: 'Test Lead Myra', source: 'Simulated property portal', type: 'Plot', location: 'Green Meadows', budget: 4500000, purpose: 'Investment', timeline: '12+ months', score: 50, stage: 'Nurture', dnc: false, created: 'Test Day 1' },
      { id: 'L-015', name: 'Test Lead Reyansh', source: 'Simulated website form', type: 'Flat', location: 'Lake View', budget: 5000000, purpose: 'Personal use', timeline: '12+ months', score: 44, stage: 'Nurture only', dnc: false, created: 'Test Day 1' },
      { id: 'L-016', name: 'Test Lead Aditi', source: 'Simulated Meta form', type: 'Commercial', location: 'Tech Square', budget: 7000000, purpose: 'Investment', timeline: '12+ months', score: 40, stage: 'Do not contact', dnc: true, created: 'Test Day 1' },
      { id: 'L-017', name: 'Test Lead Neel', source: 'Simulated manual entry', type: 'Land', location: 'Riverside', budget: 6000000, purpose: 'Investment', timeline: '12+ months', score: 36, stage: 'Nurture only', dnc: false, created: 'Test Day 1' },
      { id: 'L-018', name: 'Test Lead Riya', source: 'Simulated property portal', type: 'Villa', location: 'West Park', budget: 7500000, purpose: 'Personal use', timeline: '12+ months', score: 31, stage: 'Nurture only', dnc: false, created: 'Test Day 1' },
      { id: 'L-019', name: 'Test Lead Yash', source: 'Simulated website form', type: 'Plot', location: 'Green Meadows', budget: 3500000, purpose: 'Investment', timeline: '12+ months', score: 25, stage: 'Nurture only', dnc: false, created: 'Test Day 1' },
      { id: 'L-020', name: 'Test Lead Ira', source: 'Simulated Meta form', type: 'Flat', location: 'Central Avenue', budget: 4000000, purpose: 'Personal use', timeline: '12+ months', score: 18, stage: 'Nurture only', dnc: false, created: 'Test Day 1' }
    ],
    properties: [
      { id: 'P-101', name: 'Azure Heights', type: 'Flat', location: 'Lake View', price: 6500000, status: 'Available', detail: '3 BHK • Test inventory' },
      { id: 'P-102', name: 'Central Crest', type: 'Flat', location: 'Central Avenue', price: 8200000, status: 'Available', detail: '3 BHK • Test inventory' },
      { id: 'P-103', name: 'Orchard Residences', type: 'Flat', location: 'Lake View', price: 7200000, status: 'On Hold', detail: '4 BHK • Test inventory' },
      { id: 'P-104', name: 'Palm Enclave', type: 'Villa', location: 'West Park', price: 11500000, status: 'Available', detail: '4 BHK villa • Test inventory' },
      { id: 'P-105', name: 'Cedar Villas', type: 'Villa', location: 'West Park', price: 9800000, status: 'Sold', detail: '3 BHK villa • Test inventory' },
      { id: 'P-106', name: 'Greenfield Plots', type: 'Plot', location: 'Green Meadows', price: 5800000, status: 'Available', detail: '240 sq yd • Test inventory' },
      { id: 'P-107', name: 'Meadow Parcels', type: 'Plot', location: 'Green Meadows', price: 4400000, status: 'Available', detail: '180 sq yd • Test inventory' },
      { id: 'P-108', name: 'Nexus Square', type: 'Commercial', location: 'Tech Square', price: 8800000, status: 'Available', detail: 'Office unit • Test inventory' },
      { id: 'P-109', name: 'Harbor Point', type: 'Commercial', location: 'Tech Square', price: 7600000, status: 'On Hold', detail: 'Retail unit • Test inventory' },
      { id: 'P-110', name: 'Riverbend Acres', type: 'Land', location: 'Riverside', price: 12500000, status: 'Available', detail: '1 acre • Test inventory' }
    ],
    followups: [
      { id: 'F-001', leadId: 'L-003', due: 'Test Day 1 · 11:00', owner: 'Follow-up Agent', note: 'Simulated priority check', status: 'Due' },
      { id: 'F-002', leadId: 'L-007', due: 'Test Day 1 · 14:00', owner: 'Follow-up Agent', note: 'Simulated 3–6 month nurture', status: 'Scheduled' },
      { id: 'F-003', leadId: 'L-009', due: 'Test Day 1 · 15:30', owner: 'Follow-up Agent', note: 'Simulated plot shortlist', status: 'Scheduled' },
      { id: 'F-004', leadId: 'L-011', due: 'Test Day 1 · 09:30', owner: 'Follow-up Agent', note: 'Simulated investor check-in', status: 'Overdue' },
      { id: 'F-005', leadId: 'L-013', due: 'Test Day 2 · 10:00', owner: 'Follow-up Agent', note: 'Simulated villa preferences', status: 'Scheduled' },
      { id: 'F-006', leadId: 'L-014', due: 'Test Day 3 · 11:00', owner: 'Follow-up Agent', note: 'Simulated long-term nurture', status: 'Scheduled' },
      { id: 'F-007', leadId: 'L-015', due: 'Test Day 4 · 12:00', owner: 'Follow-up Agent', note: 'Simulated update only', status: 'Completed' }
    ],
    visits: [
      { id: 'V-001', leadId: 'L-004', propertyId: 'P-101', when: 'Test Day 2 · 11:00', status: 'Proposed', note: 'Simulated approval needed' },
      { id: 'V-002', leadId: 'L-001', propertyId: 'P-104', when: 'Test Day 2 · 15:30', status: 'Scheduled', note: 'Simulated visit' },
      { id: 'V-003', leadId: 'L-002', propertyId: 'P-106', when: 'Test Day 3 · 10:30', status: 'Scheduled', note: 'Simulated visit' },
      { id: 'V-004', leadId: 'L-006', propertyId: 'P-102', when: 'Test Day 4 · 16:00', status: 'Proposed', note: 'Simulated approval needed' }
    ],
    agents: [
      { id: 'A-01', name: 'Lead Capture Agent', icon: '↓', status: 'Active', task: 'Reading simulated lead sources', processed: 20, hot: 6, description: 'Normalizes dummy Meta, portal, website, and manual test leads.' },
      { id: 'A-02', name: 'Lead Qualification Agent', icon: '?', status: 'Active', task: 'Checking test requirements', processed: 20, hot: 6, description: 'Reviews simulated property type, location, budget, purpose, and timeline.' },
      { id: 'A-03', name: 'Lead Scoring Agent', icon: '!', status: 'Active', task: 'Scoring test leads', processed: 20, hot: 6, description: 'Assigns the HOT, WARM, or COLD test priority score.' },
      { id: 'A-04', name: 'WhatsApp Routing Agent', icon: '↗', status: 'Active', task: 'Logging manual-route notices', processed: 8, hot: 2, description: 'Records simulated direct enquiries only; it never sends or replies to messages.' },
      { id: 'A-05', name: 'Voice Calling Agent', icon: '☎', status: 'Paused', task: 'No calls permitted in Test Mode', processed: 0, hot: 0, description: 'Test-only placeholder. It cannot place calls or contact anyone.' },
      { id: 'A-06', name: 'Follow-up Agent', icon: '↻', status: 'Active', task: 'Maintaining test queue', processed: 7, hot: 1, description: 'Creates internal test tasks; it never sends communications.' },
      { id: 'A-07', name: 'Site Visit Agent', icon: '▣', status: 'Active', task: 'Preparing visit proposals', processed: 4, hot: 4, description: 'Creates internal visit proposals for test records only.' },
      { id: 'A-08', name: 'Investor Discovery Agent', icon: '◈', status: 'Active', task: 'Reviewing simulated intent', processed: 9, hot: 3, description: 'Identifies test investment interest from dummy lead data.' },
      { id: 'A-09', name: 'Property Matching Agent', icon: '⌂', status: 'Active', task: 'Matching Available inventory', processed: 20, hot: 6, description: 'Matches only test properties currently marked Available.' },
      { id: 'A-10', name: 'AI Sales Manager', icon: '★', status: 'Active', task: 'Prioritizing safe test actions', processed: 20, hot: 6, description: 'Summarizes the dummy pipeline and recommends internal test actions.' }
    ],
    activities: [
      { at: 'Test Day 1 · 10:15', agentId: 'A-10', title: 'AI Sales Manager prioritized 6 HOT test leads', detail: 'Internal dashboard recommendation only; no contact was attempted.' },
      { at: 'Test Day 1 · 10:12', agentId: 'A-09', title: 'Property Matching Agent refreshed Available inventory', detail: 'On Hold and Sold test properties were excluded from matches.' },
      { at: 'Test Day 1 · 10:08', agentId: 'A-07', title: 'Site Visit Agent prepared 2 visit proposals', detail: 'Proposals require an internal test approval and are not appointments.' },
      { at: 'Test Day 1 · 10:05', agentId: 'A-06', title: 'Follow-up Agent created test queue items', detail: 'The queue is an internal checklist; no message or call was sent.' },
      { at: 'Test Day 1 · 09:58', agentId: 'A-03', title: 'Lead Scoring Agent classified 20 dummy leads', detail: '6 HOT, 8 WARM, and 6 COLD leads were assigned.' },
      { at: 'Test Day 1 · 09:50', agentId: 'A-01', title: 'Lead Capture Agent loaded dummy leads', detail: 'All source labels are simulated and not connected to any accounts.' }
    ]
  };

  var data = loadData();

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadData() {
    return deepClone(SEED);
  }

  function saveData() {
    if (!csrfToken) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      fetch('/api/state', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ state: data })
      }).then(function (response) {
        if (!response.ok) throw new Error('save failed');
        return response.json();
      }).catch(function () {
        toast('The private server could not save this Test Mode change. Refresh and sign in again.', true);
      });
    }, 150);
  }

  function requestServer(method, endpoint, body) {
    return fetch(endpoint, {
      method: method,
      credentials: 'same-origin',
      headers: Object.assign({ 'Content-Type': 'application/json' }, csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }

  function openPortal(payload) {
    csrfToken = payload.csrf;
    data = payload.state;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('portal').classList.remove('hidden');
    render();
  }

  function restoreSession() {
    fetch('/api/session', { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) return null;
        return response.json();
      })
      .then(function (payload) {
        if (payload && payload.authenticated) openPortal(payload);
      })
      .catch(function () {
        /* The sign-in screen remains available if the private server is not reachable. */
      });
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMoney(value) {
    return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
  }

  function scoreTier(lead) {
    if (lead.score >= 80) return 'HOT';
    if (lead.score >= 50) return 'WARM';
    return 'COLD';
  }

  function tierBadge(lead) {
    var tier = scoreTier(lead);
    return '<span class="tier ' + tier.toLowerCase() + '">' + tier + ' ' + lead.score + '</span>';
  }

  function statusClass(value) {
    var classes = {
      'Available': 'available',
      'Sold': 'sold',
      'On Hold': 'on-hold',
      'Due': 'on-hold',
      'Scheduled': 'scheduled',
      'Proposed': 'scheduled',
      'Overdue': 'overdue',
      'Completed': 'completed',
      'Active': 'active',
      'Paused': 'paused',
      'Working': 'working',
      'Blocked': 'blocked'
    };
    return classes[value] || '';
  }

  function statusBadge(value) {
    return '<span class="status ' + statusClass(value) + '">' + escapeHtml(value) + '</span>';
  }

  function getLead(id) {
    return data.leads.find(function (lead) { return lead.id === id; });
  }

  function getProperty(id) {
    return data.properties.find(function (property) { return property.id === id; });
  }

  function getAgent(id) {
    return data.agents.find(function (agent) { return agent.id === id; });
  }

  function agentName(id) {
    var agent = getAgent(id);
    return agent ? agent.name : 'System';
  }

  function addActivity(agentId, title, detail) {
    data.activities.unshift({
      at: 'Test session · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      agentId: agentId,
      title: title,
      detail: detail
    });
    data.activities = data.activities.slice(0, 60);
  }

  function getMatches(lead) {
    if (!lead || lead.dnc) return [];
    return data.properties
      .filter(function (property) { return property.status === 'Available' && property.type === lead.type; })
      .map(function (property) {
        var score = 50;
        if (property.location === lead.location) score += 30;
        if (lead.budget >= property.price) score += 20;
        else if (lead.budget >= property.price * 0.9) score += 12;
        return { property: property, score: score };
      })
      .sort(function (a, b) { return b.score - a.score; });
  }

  function leadName(id) {
    var lead = getLead(id);
    return lead ? lead.name : 'Unknown test lead';
  }

  function propertyName(id) {
    var property = getProperty(id);
    return property ? property.name : 'Unknown test property';
  }

  function dueFollowups() {
    return data.followups.filter(function (item) { return item.status === 'Due' || item.status === 'Overdue'; });
  }

  function hotLeads() {
    return data.leads.filter(function (lead) { return scoreTier(lead) === 'HOT' && !lead.dnc; });
  }

  function availableProperties() {
    return data.properties.filter(function (property) { return property.status === 'Available'; });
  }

  function nonCompleteVisits() {
    return data.visits.filter(function (visit) { return visit.status !== 'Completed'; });
  }

  function setView(view) {
    currentView = view;
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.classList.toggle('active', item.getAttribute('data-view') === view);
    });
    document.querySelector('.sidebar').classList.remove('open');
    render();
  }

  function render() {
    var titles = {
      dashboard: 'Dashboard',
      leads: 'Test Leads',
      properties: 'Properties',
      followups: 'Follow-ups',
      visits: 'Site Visits',
      agents: 'AI Agent Control',
      inbox: 'Inbox & Approvals',
      reports: 'Reports'
    };
    document.getElementById('page-title').textContent = titles[currentView] || 'Dashboard';
    var view = document.getElementById('view');
    if (currentView === 'leads') view.innerHTML = renderLeads();
    else if (currentView === 'properties') view.innerHTML = renderProperties();
    else if (currentView === 'followups') view.innerHTML = renderFollowups();
    else if (currentView === 'visits') view.innerHTML = renderVisits();
    else if (currentView === 'agents') view.innerHTML = renderAgents();
    else if (currentView === 'inbox') { view.innerHTML = renderInbox(); loadInbox(); }
    else if (currentView === 'reports') view.innerHTML = renderReports();
    else view.innerHTML = renderDashboard();
  }

  function renderDashboard() {
    var hot = hotLeads();
    var due = dueFollowups();
    var visits = nonCompleteVisits();
    var available = availableProperties();
    var recentHot = hot.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 5);
    var actionRows = due.concat(data.followups.filter(function (item) { return item.status === 'Scheduled'; })).slice(0, 5);
    return ''
      + '<div class="view-header"><div><h2>Today’s simulated command center</h2><p>Review the full test workflow safely: dummy lead → score → available property match → internal task.</p></div><button class="button primary" data-action="run-simulation">Run safe simulation</button></div>'
      + '<div class="kpi-grid">'
      + kpi('Test leads', data.leads.length, '20 seeded dummy leads')
      + kpi('HOT leads', hot.length, 'Priority test review')
      + kpi('Due follow-ups', due.length, 'Internal checklist only')
      + kpi('Site visits', visits.length, 'Proposals and test visits')
      + kpi('Available properties', available.length, 'Only these can match')
      + '</div>'
      + '<div class="dashboard-grid">'
      + '<section class="card"><div class="card-head"><h3>HOT test leads to review</h3><button class="link-button" data-action="show-view" data-view="leads">View all leads</button></div>'
      + (recentHot.length ? '<div class="list">' + recentHot.map(renderHotLead).join('') + '</div>' : '<div class="empty">No eligible HOT test leads.</div>')
      + '</section>'
      + '<section class="card"><div class="card-head"><h3>Internal next actions</h3><span class="subtle">No outreach occurs</span></div>'
      + (actionRows.length ? '<div class="list">' + actionRows.map(renderAction).join('') + '</div>' : '<div class="empty">No test actions waiting.</div>')
      + '</section>'
      + '</div>'
      + '<div class="dashboard-grid">'
      + '<section class="card"><div class="card-head"><h3>AI Sales Manager recommendation</h3><span class="tag">SIMULATED</span></div>'
      + '<div class="callout"><strong>Safe recommendation:</strong> Review ' + hot.length + ' HOT dummy leads first. The matching agent currently sees ' + available.length + ' Available test properties. Any property set to On Hold or Sold is automatically excluded from matching.</div>'
      + '<div class="footer-note">This recommendation is generated from sample data stored only in this browser. It is not AI outreach and does not contact anyone.</div>'
      + '</section>'
      + '<section class="card"><div class="card-head"><h3>Recent agent activity</h3><button class="link-button" data-action="show-view" data-view="agents">Agent control</button></div>'
      + renderActivityList(data.activities.slice(0, 4))
      + '</section>'
      + '</div>';
  }

  function kpi(label, number, foot) {
    return '<article class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-number">' + number + '</div><div class="kpi-foot">' + foot + '</div></article>';
  }

  function renderHotLead(lead) {
    var matchCount = getMatches(lead).length;
    return '<div class="list-row"><div class="avatar">' + escapeHtml(lead.name.replace('Test Lead ', '').slice(0, 2).toUpperCase()) + '</div><div class="list-main"><strong>' + escapeHtml(lead.name) + '</strong><span>' + escapeHtml(lead.type) + ' · ' + escapeHtml(lead.location) + ' · ' + formatMoney(lead.budget) + ' · ' + matchCount + ' test matches</span></div><div class="right-align">' + tierBadge(lead) + '<br><button class="link-button" data-action="view-lead" data-id="' + lead.id + '">Review</button></div></div>';
  }

  function renderAction(item) {
    var lead = getLead(item.leadId);
    return '<div class="list-row"><div class="avatar">↻</div><div class="list-main"><strong>' + escapeHtml(lead ? lead.name : 'Test lead') + '</strong><span>' + escapeHtml(item.note) + ' · ' + escapeHtml(item.due) + '</span></div><div class="right-align">' + statusBadge(item.status) + '<br><button class="link-button" data-action="complete-followup" data-id="' + item.id + '">Complete</button></div></div>';
  }

  function renderLeads() {
    var filtered = data.leads.filter(function (lead) {
      var text = [lead.name, lead.source, lead.type, lead.location, lead.stage].join(' ').toLowerCase();
      var searchOk = !leadFilter.search || text.indexOf(leadFilter.search.toLowerCase()) > -1;
      var tierOk = leadFilter.tier === 'ALL' || scoreTier(lead) === leadFilter.tier;
      var dncOk = leadFilter.dnc === 'ALL' || (leadFilter.dnc === 'DNC' && lead.dnc) || (leadFilter.dnc === 'CONTACTABLE' && !lead.dnc);
      return searchOk && tierOk && dncOk;
    });
    return ''
      + '<div class="view-header"><div><h2>20 simulated leads</h2><p>All labels and source names are test data. No phone numbers, contact tools, or communication accounts exist in this package.</p></div><button class="button primary" data-action="open-add-lead">Add test lead</button></div>'
      + '<form id="lead-filter" class="toolbar"><div class="field grow"><label>Search sample data<input name="search" value="' + escapeHtml(leadFilter.search) + '" placeholder="Name, property type, source, location"></label></div><div class="field"><label>Priority<select name="tier">' + option('ALL', 'All priorities', leadFilter.tier) + option('HOT', 'HOT', leadFilter.tier) + option('WARM', 'WARM', leadFilter.tier) + option('COLD', 'COLD', leadFilter.tier) + '</select></label></div><div class="field"><label>Contact setting<select name="dnc">' + option('ALL', 'All records', leadFilter.dnc) + option('CONTACTABLE', 'Contactable test records', leadFilter.dnc) + option('DNC', 'Do Not Contact', leadFilter.dnc) + '</select></label></div><button class="button secondary small" type="submit">Filter</button><button class="link-button" type="button" data-action="clear-lead-filters">Clear</button></form>'
      + '<div class="table-wrap"><table><thead><tr><th>Test lead</th><th>Requirement</th><th>Budget & purpose</th><th>Score</th><th>Stage</th><th>Safety setting</th><th></th></tr></thead><tbody>'
      + (filtered.length ? filtered.map(renderLeadRow).join('') : '<tr><td colspan="7"><div class="empty">No test leads match these filters.</div></td></tr>')
      + '</tbody></table></div>'
      + '<p class="footer-note">Change a dummy lead to Do Not Contact to verify it disappears from matching and simulations. The setting is stored only on this computer until you reset the demo.</p>';
  }

  function renderLeadRow(lead) {
    return '<tr><td><strong>' + escapeHtml(lead.name) + '</strong><small>' + escapeHtml(lead.id) + ' · ' + escapeHtml(lead.source) + '</small></td><td><strong>' + escapeHtml(lead.type) + '</strong><small>' + escapeHtml(lead.location) + ' · ' + escapeHtml(lead.timeline) + '</small></td><td><strong>' + formatMoney(lead.budget) + '</strong><small>' + escapeHtml(lead.purpose) + '</small></td><td>' + tierBadge(lead) + '</td><td><span class="tag">' + escapeHtml(lead.stage) + '</span></td><td>' + (lead.dnc ? statusBadge('Blocked') : '<span class="tag">Contactable test record</span>') + '</td><td><div class="table-actions"><button class="link-button" data-action="view-lead" data-id="' + lead.id + '">View</button><button class="link-button muted" data-action="toggle-dnc" data-id="' + lead.id + '">' + (lead.dnc ? 'Allow test workflow' : 'Do Not Contact') + '</button></div></td></tr>';
  }

  // ─────────────────────────────────────────────────────────────
  //  Properties — add / edit, photos, Google location pin, client view
  // ─────────────────────────────────────────────────────────────
  var pendingPhotos = [];   // { dataUrl, caption } waiting to be uploaded
  var geoDraft = null;      // parsed { lat, lng } for the property form

  function propertyById(id) {
    return data.properties.filter(function (property) { return property.id === id; })[0] || null;
  }

  function photoUrl(photo) { return '/media/' + photo.id; }

  function locationLabel(geo) {
    if (!geo) return '';
    return geo.area || geo.label || (geo.lat + ', ' + geo.lng);
  }

  function mapsLink(geo) {
    if (!geo) return '';
    return geo.mapsUrl || ('https://www.google.com/maps?q=' + geo.lat + ',' + geo.lng);
  }

  function mapsEmbed(geo) {
    return 'https://www.google.com/maps?q=' + encodeURIComponent(geo.lat + ',' + geo.lng) + '&z=15&output=embed';
  }

  // Google Maps link (Share → Copy link) ya seedha "lat,lng" se coordinates nikaalo.
  function parseGeoInput(text) {
    var value = String(text || '').trim();
    if (!value) return null;
    var patterns = [
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,          // full place URL
      /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,              // /@26.91,75.78,15z
      /[?&]q=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/, // ?q=26.91,75.78
      /[?&]ll=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
      /(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/ // raw lat,lng
    ];
    for (var index = 0; index < patterns.length; index += 1) {
      var match = value.match(patterns[index]);
      if (match) {
        var lat = Number(match[1]);
        var lng = Number(match[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat: lat, lng: lng };
      }
    }
    return null;
  }

  // Browser me photo chhoti karo (Railway storage bachane ke liye): max 1600px, JPEG.
  function compressImage(file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Photo padhi nahi ja saki.')); };
      reader.onload = function () {
        var image = new Image();
        image.onerror = function () { reject(new Error('Ye file image nahi hai.')); };
        image.onload = function () {
          var scale = Math.min(1, maxDim / Math.max(image.width, image.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function copyText(text, okMessage) {
    function fallback() {
      var area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); toast(okMessage); } catch (error) { window.prompt('Copy karo:', text); }
      document.body.removeChild(area);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(okMessage); }).catch(fallback);
    } else {
      fallback();
    }
  }

  function refreshState() {
    return requestServer('GET', '/api/session')
      .then(function (response) { return response.json(); })
      .then(function (payload) { if (payload && payload.state) { data = payload.state; render(); } });
  }

  function renderProperties() {
    var rows = data.properties.map(function (property) {
      var photos = property.photos || [];
      var geo = property.geo || null;
      return '<tr>'
        + '<td><button type="button" class="link-button strong" data-action="view-property" data-id="' + property.id + '">' + escapeHtml(property.name) + ' ↗</button>'
        + '<small>' + escapeHtml(property.id) + ' · ' + escapeHtml(property.detail || '') + '</small>'
        + '<small>' + (photos.length ? '📷 ' + photos.length + ' photo' + (photos.length > 1 ? 's' : '') : '<span class="mut">koi photo nahi</span>')
        + ' · ' + (geo ? '📍 ' + escapeHtml(locationLabel(geo)) : '<span class="mut">pin nahi</span>') + '</small></td>'
        + '<td><strong>' + escapeHtml(property.type) + '</strong><small>' + escapeHtml(property.location) + '</small></td>'
        + '<td><strong>' + formatMoney(property.price) + '</strong><small>' + escapeHtml(String(property.status)) + '</small></td>'
        + '<td><select aria-label="Set status for ' + escapeHtml(property.name) + '" data-action="change-property-status" data-id="' + property.id + '">'
        + option('Available', 'Available', property.status) + option('On Hold', 'On Hold', property.status) + option('Sold', 'Sold', property.status) + '</select></td>'
        + '<td class="row-actions">'
        + '<button type="button" class="button secondary small" data-action="view-property" data-id="' + property.id + '">👁 Client view</button> '
        + '<button type="button" class="button secondary small" data-action="edit-property" data-id="' + property.id + '">✏️ Edit</button> '
        + '<button type="button" class="button secondary small" data-action="copy-share-link" data-id="' + property.id + '">🔗 Link</button>'
        + '</td></tr>';
    }).join('');
    var withPhotos = data.properties.filter(function (p) { return (p.photos || []).length; }).length;
    var withPin = data.properties.filter(function (p) { return Boolean(p.geo); }).length;
    return ''
      + '<div class="view-header"><div><h2>Property inventory</h2><p>Photos aur Google location pin add karo. Jab client WhatsApp par maange to AI ke draft me photo/location khud lag jaati hai — approve karne par hi jaati hai.</p></div>'
      + '<button class="button primary" data-action="open-add-property">＋ Add property</button></div>'
      + '<div class="kpi-grid">'
      + kpi('Total properties', data.properties.length, 'Flats, villas, plots, commercial, land')
      + kpi('Available', data.properties.filter(function (p) { return p.status === 'Available'; }).length, 'Eligible for matching')
      + kpi('Photos added', withPhotos, 'Photo wali properties')
      + kpi('Location pins', withPin, 'Map pin wali properties')
      + kpi('On hold + Sold', data.properties.filter(function (p) { return p.status !== 'Available'; }).length, 'Excluded from matching')
      + '</div>'
      + '<div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>Property · media</th><th>Type & location</th><th>Price / status</th><th>Availability</th><th>Actions</th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="5">Abhi koi property nahi. "＋ Add property" dabao.</td></tr>')
      + '</tbody></table></div><p class="footer-note">Photos aur location pin sirf property ki details ke liye hain — status change matching ko affect karta hai.</p>';
  }

  // ── Client view: gallery + Google map + "bhejo" actions ──
  function showPropertyModal(id) {
    var property = propertyById(id);
    if (!property) return;
    var photos = property.photos || [];
    var geo = property.geo || null;
    var gallery = photos.length
      ? '<div class="gallery-grid">' + photos.map(function (photo, index) {
          return '<button type="button" class="shot" data-action="open-lightbox" data-src="' + photoUrl(photo) + '">'
            + '<img src="' + photoUrl(photo) + '" alt="' + escapeHtml(property.name) + ' photo ' + (index + 1) + '" loading="lazy"></button>';
        }).join('') + '</div>'
      : '<div class="empty">Abhi koi photo nahi hai. <b>✏️ Edit</b> se photos upload karo — client ko dikhane ke liye yahi gallery use hogi.</div>';
    var mapBlock = geo
      ? '<iframe class="map-frame" src="' + mapsEmbed(geo) + '" loading="lazy" title="Property map" referrerpolicy="no-referrer-when-downgrade"></iframe>'
        + '<p class="pin-line">📍 <b>' + escapeHtml(locationLabel(geo)) + '</b> · <a href="' + escapeHtml(mapsLink(geo)) + '" target="_blank" rel="noopener">Google Maps me kholo ↗</a></p>'
      : '<div class="empty">Location pin nahi hai. <b>✏️ Edit</b> kholo → client ka Google Maps link paste karo → "Pin nikalo" dabao.</div>';
    var leadOptions = data.leads.filter(function (lead) { return !lead.dnc; }).map(function (lead) {
      return option(lead.id, lead.name + ' — ' + scoreTier(lead) + ' · ' + lead.type, '');
    }).join('');
    showModal(property.name, property.type + ' · ' + property.location + ' · ' + formatMoney(property.price), ''
      + gallery
      + '<div class="detail-summary" style="grid-template-columns:repeat(4,1fr)">'
      +   '<div class="detail-box"><span>Price</span><strong>' + formatMoney(property.price) + '</strong></div>'
      +   '<div class="detail-box"><span>Type</span><strong>' + escapeHtml(property.type) + '</strong></div>'
      +   '<div class="detail-box"><span>Status</span><strong>' + escapeHtml(property.status) + '</strong></div>'
      +   '<div class="detail-box"><span>Photos</span><strong>' + photos.length + '</strong></div>'
      + '</div>'
      + '<div class="detail-box" style="margin-bottom:14px"><span>Detail</span><strong>' + escapeHtml(property.detail || '—') + '</strong></div>'
      + mapBlock
      + '<div class="card" style="margin-top:16px"><div class="card-head"><h3>📤 Client ko bhejo (WhatsApp draft)</h3></div>'
      +   '<div class="form-grid">'
      +     '<label>Lead<select id="prop-send-lead">' + leadOptions + '</select></label>'
      +   '</div>'
      +   '<div class="modal-foot" style="justify-content:flex-start;gap:8px;flex-wrap:wrap">'
      +     '<button type="button" class="button primary small" data-action="send-property" data-id="' + property.id + '" data-attach="photos">📷 Photos bhejo</button>'
      +     '<button type="button" class="button primary small" data-action="send-property" data-id="' + property.id + '" data-attach="location">📍 Location bhejo</button>'
      +     '<button type="button" class="button secondary small" data-action="send-property" data-id="' + property.id + '" data-attach="both">📷📍 Dono bhejo</button>'
      +   '</div>'
      +   '<p class="mut" style="font-size:12px;margin-top:8px">Draft Inbox me banega — <b>Approve</b> karne par hi client ko jaayega. TEST mode me sirf dry run hota hai.</p>'
      + '</div>'
      + '<div class="modal-foot"><button type="button" class="button secondary" data-action="close-modal">Close</button>'
      +   '<button type="button" class="button secondary" data-action="copy-share-link" data-id="' + property.id + '">🔗 Public link copy karo</button>'
      +   '<button type="button" class="button primary" data-action="edit-property" data-id="' + property.id + '">✏️ Edit</button></div>', true);
  }

  // ── Add / Edit property form (photos + location pin) ──
  function showPropertyFormModal(id) {
    var property = id ? propertyById(id) : null;
    pendingPhotos = [];
    geoDraft = property && property.geo ? { lat: property.geo.lat, lng: property.geo.lng } : null;
    var photos = property ? (property.photos || []) : [];
    var locations = ['Jaipur', 'Vaishali Nagar', 'Mansarovar', 'Jagatpura', 'Malviya Nagar', 'C-Scheme', 'Tonk Road', 'Ajmer Road', 'Sikar Road', 'Ring Road'];
    var gallery = photos.length
      ? '<div class="gallery-grid">' + photos.map(function (photo, index) {
          return '<div class="shot"><img src="' + photoUrl(photo) + '" alt="photo ' + (index + 1) + '">'
            + '<button type="button" class="shot-delete" title="Photo hatao" data-action="remove-photo" data-id="' + property.id + '" data-media="' + photo.id + '">×</button></div>';
        }).join('') + '</div>'
      : '';
    showModal(property ? ('Edit: ' + property.name) : 'Add property', 'Photos aur Google Maps location pin — client ko yahi dikhega.', ''
      + '<form id="property-form" data-id="' + (property ? property.id : '') + '"><div class="form-grid">'
      +   '<label>Property ka naam<input name="name" required maxlength="80" value="' + (property ? escapeHtml(property.name) : '') + '" placeholder="e.g. Shanti Residency"></label>'
      +   '<label>Type<select name="type">' + propertyTypeOptions(property ? property.type : 'Flat') + '</select></label>'
      +   '<label>Area / Location<input name="location" list="area-list" required value="' + (property ? escapeHtml(property.location) : '') + '" placeholder="e.g. Vaishali Nagar">'
      +     '<datalist id="area-list">' + locations.map(function (name) { return '<option value="' + escapeHtml(name) + '"></option>'; }).join('') + '</datalist></label>'
      +   '<label>Price (₹)<input name="price" type="number" min="0" required value="' + (property ? property.price : 6000000) + '"></label>'
      +   '<label>Status<select name="status">' + option('Available', 'Available', property ? property.status : 'Available') + option('On Hold', 'On Hold', '') + option('Sold', 'Sold', '') + '</select></label>'
      +   '<label>Detail<textarea name="detail" rows="2" placeholder="e.g. 3 BHK · 1450 sqft · 2nd floor">' + (property ? escapeHtml(property.detail || '') : '') + '</textarea></label>'
      + '</div>'
      + '<div class="card" style="margin-top:6px"><div class="card-head"><h3>📍 Google location pin</h3></div>'
      +   '<label>Google Maps link paste karo <span class="mut">(phone me: Maps → Share → Copy link)</span>'
      +     '<input id="geo-input" placeholder="https://maps.app.goo.gl/... ya 26.9124, 75.7873"></label>'
      +   '<div class="form-grid" style="margin-top:10px">'
      +     '<label>Latitude<input id="geo-lat" type="number" step="any" placeholder="26.9124" value="' + (geoDraft ? geoDraft.lat : '') + '"></label>'
      +     '<label>Longitude<input id="geo-lng" type="number" step="any" placeholder="75.7873" value="' + (geoDraft ? geoDraft.lng : '') + '"></label>'
      +   '</div>'
      +   '<div class="modal-foot" style="justify-content:flex-start;gap:8px"><button type="button" class="button secondary small" data-action="parse-geo">🔎 Pin nikalo</button>'
      +     '<button type="button" class="button secondary small" data-action="clear-geo">✖ Pin hatao</button></div>'
      +   '<div id="geo-status" class="mut" style="font-size:12px;margin-top:6px">' + (geoDraft ? '📍 Pin set: ' + geoDraft.lat + ', ' + geoDraft.lng : (property && property.geo ? '📍 Pin set: ' + property.geo.lat + ', ' + property.geo.lng : 'Abhi koi pin nahi.')) + '</div>'
      +   '<div id="geo-map"></div>'
      + '</div>'
      + '<div class="card" style="margin-top:12px"><div class="card-head"><h3>📷 Photos</h3></div>'
      +   gallery
      +   '<label class="upload-label">Photo chuno (ek saath kai chalengi — auto compress hongi)<input id="photo-input" type="file" accept="image/*" multiple></label>'
      +   '<div id="pending-photos" class="gallery-grid"></div>'
      +   '<p class="mut" style="font-size:12px">Max 12 photos per property · har photo 5 MB tak (browser khud chhota kar deta hai).</p>'
      + '</div>'
      + '<div class="modal-foot"><button type="button" class="button secondary" data-action="close-modal">Cancel</button>'
      +   '<button type="submit" class="button primary">' + (property ? '💾 Save karo' : '＋ Property add karo') + '</button></div></form>');
    renderGeoMapPreview();
  }

  function renderGeoMapPreview() {
    var node = document.getElementById('geo-map');
    if (!node) return;
    node.innerHTML = geoDraft
      ? '<iframe class="map-frame" style="margin-top:10px" src="' + mapsEmbed(geoDraft) + '" loading="lazy" title="Pin preview"></iframe>'
      : '';
  }

  function renderPendingPhotos() {
    var node = document.getElementById('pending-photos');
    if (!node) return;
    node.innerHTML = pendingPhotos.map(function (photo, index) {
      return '<div class="shot"><img src="' + photo.dataUrl + '" alt="new photo ' + (index + 1) + '">'
        + '<button type="button" class="shot-delete" data-action="drop-pending-photo" data-index="' + index + '">×</button></div>';
    }).join('');
  }

  async function handlePhotoPick(input) {
    var files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    for (var index = 0; index < files.length; index += 1) {
      try {
        var dataUrl = await compressImage(files[index], 1600, 0.82);
        pendingPhotos.push({ dataUrl: dataUrl, caption: '' });
      } catch (error) {
        toast(error.message, true);
      }
    }
    renderPendingPhotos();
    if (files.length) toast(files.length + ' photo ready — "Save" dabao to upload hongi.');
  }

  async function uploadPendingPhotos(propertyId) {
    var uploaded = 0;
    for (var index = 0; index < pendingPhotos.length; index += 1) {
      var response = await requestServer('POST', '/api/properties/' + propertyId + '/photos', { dataUrl: pendingPhotos[index].dataUrl, caption: pendingPhotos[index].caption });
      var payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Photo upload fail hui.');
      uploaded += 1;
    }
    pendingPhotos = [];
    return uploaded;
  }

  async function savePropertyForm(form) {
    var values = new FormData(form);
    var id = form.getAttribute('data-id');
    var lat = document.getElementById('geo-lat');
    var lng = document.getElementById('geo-lng');
    var geo = null;
    if (lat && lng && lat.value !== '' && lng.value !== '') {
      geo = { lat: Number(lat.value), lng: Number(lng.value), label: values.get('name'), area: values.get('location') };
    }
    var payload = {
      name: values.get('name'), type: values.get('type'), location: values.get('location'),
      price: Number(values.get('price')), status: values.get('status'), detail: values.get('detail'), geo: geo
    };
    var response = await requestServer(id ? 'PUT' : 'POST', id ? '/api/properties/' + id : '/api/properties', payload);
    var result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Save nahi hua.');
    var propertyId = result.property.id;
    var uploaded = 0;
    if (pendingPhotos.length) uploaded = await uploadPendingPhotos(propertyId);
    await refreshState();
    closeModal();
    setView('properties');
    toast((id ? 'Property update ho gayi' : 'Property add ho gayi') + (uploaded ? ' — ' + uploaded + ' photo upload hui' : '') + '.');
  }

  function sendPropertyAttachment(propertyId, attach) {
    var leadSelect = document.getElementById('prop-send-lead');
    var property = propertyById(propertyId);
    requestServer('POST', '/api/outbox/ai-draft', {
      leadId: leadSelect ? leadSelect.value : '', channel: 'whatsapp', inbound: '', propertyId: propertyId, attach: attach
    })
      .then(function (response) { return response.json().then(function (payload) { if (!response.ok) throw new Error(payload.error || 'Draft fail hua.'); return payload; }); })
      .then(function (payload) {
        closeModal();
        setView('inbox');
        toast('Draft ready (' + (property ? property.name : '') + ') — Inbox me approve karo, tabhi client ko jaayega.');
      })
      .catch(function (error) { toast(error.message, true); });
  }

  function openLightbox(src) {
    var root = document.getElementById('lightbox-root');
    if (!root) return;
    root.innerHTML = '<div class="lightbox" data-action="close-lightbox"><img src="' + src + '" alt="Property photo"></div>';
  }

  function closeLightbox() {
    var root = document.getElementById('lightbox-root');
    if (root) root.innerHTML = '';
  }

  function renderFollowups() {
    var visible = data.followups.slice().sort(function (a, b) {
      var rank = { Overdue: 0, Due: 1, Scheduled: 2, Completed: 3 };
      return rank[a.status] - rank[b.status];
    });
    return ''
      + '<div class="view-header"><div><h2>Internal follow-up test queue</h2><p>These are local checklist items only. Completing one does not call, message, or contact a person.</p></div><button class="button primary" data-action="open-add-followup">Create test follow-up</button></div>'
      + '<div class="kpi-grid">' + kpi('Due now', data.followups.filter(function (f) { return f.status === 'Due'; }).length, 'Safe test tasks') + kpi('Overdue', data.followups.filter(function (f) { return f.status === 'Overdue'; }).length, 'Check workflow behavior') + kpi('Scheduled', data.followups.filter(function (f) { return f.status === 'Scheduled'; }).length, 'Future test items') + kpi('Completed', data.followups.filter(function (f) { return f.status === 'Completed'; }).length, 'Local test history') + kpi('DNC protected', data.leads.filter(function (l) { return l.dnc; }).length, 'Excluded from new tasks') + '</div>'
      + '<div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>Test lead</th><th>Due</th><th>Internal note</th><th>Owner</th><th>Status</th><th></th></tr></thead><tbody>'
      + visible.map(function (item) { return '<tr><td><strong>' + escapeHtml(leadName(item.leadId)) + '</strong><small>' + escapeHtml(item.leadId) + '</small></td><td>' + escapeHtml(item.due) + '</td><td>' + escapeHtml(item.note) + '</td><td>' + escapeHtml(item.owner) + '</td><td>' + statusBadge(item.status) + '</td><td>' + (item.status !== 'Completed' ? '<button class="link-button" data-action="complete-followup" data-id="' + item.id + '">Mark complete</button>' : '<span class="tag">Logged locally</span>') + '</td></tr>'; }).join('')
      + '</tbody></table></div>';
  }

  function renderVisits() {
    return ''
      + '<div class="view-header"><div><h2>Site-visit test board</h2><p>Test proposals show the handoff from a matched lead to your internal approval. They are never real appointments.</p></div><button class="button primary" data-action="open-add-visit">Schedule test visit</button></div>'
      + '<div class="grid-two"><section class="card"><div class="card-head"><h3>Upcoming test visits</h3><span class="subtle">' + nonCompleteVisits().length + ' records</span></div><div class="list">'
      + (nonCompleteVisits().map(function (visit) {
        return '<div class="list-row"><div class="avatar">▣</div><div class="list-main"><strong>' + escapeHtml(leadName(visit.leadId)) + ' → ' + escapeHtml(propertyName(visit.propertyId)) + '</strong><span>' + escapeHtml(visit.when) + ' · ' + escapeHtml(visit.note) + '</span></div><div class="right-align">' + statusBadge(visit.status) + '<br><button class="link-button" data-action="complete-visit" data-id="' + visit.id + '">Mark complete</button></div></div>';
      }).join('') || '<div class="empty">No test visits are planned.</div>') + '</div></section>'
      + '<section class="card"><div class="card-head"><h3>Test visit guardrails</h3><span class="tag">SAFE</span></div><div class="callout"><strong>Workflow:</strong> test property match → internal proposal → manual test approval → local status update. This static package has no calendar connection, map, phone, email, or notification integration.</div><div class="footer-note">Marking a visit complete is simply a way to test dashboard/report counts.</div></section></div>'
      + '<div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>Test visit</th><th>Lead</th><th>Test property</th><th>When</th><th>Status</th><th>Action</th></tr></thead><tbody>'
      + data.visits.map(function (visit) { return '<tr><td><strong>' + escapeHtml(visit.id) + '</strong><small>' + escapeHtml(visit.note) + '</small></td><td>' + escapeHtml(leadName(visit.leadId)) + '</td><td>' + escapeHtml(propertyName(visit.propertyId)) + '</td><td>' + escapeHtml(visit.when) + '</td><td>' + statusBadge(visit.status) + '</td><td>' + (visit.status !== 'Completed' ? '<button class="link-button" data-action="complete-visit" data-id="' + visit.id + '">Complete test visit</button>' : '<span class="tag">Logged locally</span>') + '</td></tr>'; }).join('')
      + '</tbody></table></div>';
  }

  function renderAgents() {
    return ''
      + '<div class="view-header"><div><h2>10-agent simulated control center</h2><p>Agents work only on local dummy records. “Test action” creates a local activity log entry; it cannot reach any customer or service.</p></div><button class="button primary" data-action="run-simulation">Run all active agents</button></div>'
      + '<div class="agent-grid">' + data.agents.map(function (agent) {
        return '<article class="agent-card"><div class="agent-top"><div class="agent-icon">' + escapeHtml(agent.icon) + '</div><div><h3>' + escapeHtml(agent.name) + '</h3><p>' + escapeHtml(agent.task) + '</p></div></div><div class="agent-stats"><div><span>Test items processed</span><strong>' + agent.processed + '</strong></div><div><span>HOT test leads</span><strong>' + agent.hot + '</strong></div></div><p>' + escapeHtml(agent.description) + '</p><div class="agent-bottom"><div class="switch"><button class="' + (agent.status === 'Active' ? 'selected' : '') + '" data-action="set-agent-status" data-id="' + agent.id + '" data-status="Active">ON</button><button class="' + (agent.status === 'Paused' ? 'selected' : '') + '" data-action="set-agent-status" data-id="' + agent.id + '" data-status="Paused">PAUSE</button></div><div>' + statusBadge(agent.status) + ' <button class="link-button" data-action="test-agent" data-id="' + agent.id + '">Test action</button></div></div></article>';
      }).join('') + '</div>'
      + '<section class="card" style="margin-top:16px"><div class="card-head"><h3>Agent activity log</h3><span class="subtle">Local test history</span></div>' + renderActivityList(data.activities.slice(0, 14)) + '</section>';
  }

  function renderActivityList(items) {
    if (!items.length) return '<div class="empty">No local activity has been logged yet.</div>';
    return '<div>' + items.map(function (item) {
      return '<div class="activity-row"><div class="activity-dot"></div><div><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.at) + ' · ' + escapeHtml(agentName(item.agentId)) + '<br>' + escapeHtml(item.detail) + '</span></div></div>';
    }).join('') + '</div>';
  }

  function renderReports() {
    var sources = {};
    data.leads.forEach(function (lead) { sources[lead.source] = (sources[lead.source] || 0) + 1; });
    var total = data.leads.length || 1;
    var completedVisits = data.visits.filter(function (visit) { return visit.status === 'Completed'; }).length;
    var activeVisits = nonCompleteVisits().length;
    var followCompleted = data.followups.filter(function (item) { return item.status === 'Completed'; }).length;
    var maxSource = Math.max.apply(null, Object.keys(sources).map(function (key) { return sources[key]; }));
    return ''
      + '<div class="view-header"><div><h2>Test-mode reports</h2><p>Counts update instantly as you test scoring, property status, follow-ups, and visit outcomes.</p></div><button class="button secondary" data-action="export-data">Export test data</button></div>'
      + '<div class="kpi-grid">' + kpi('Lead → HOT rate', Math.round((hotLeads().length / total) * 100) + '%', hotLeads().length + ' HOT of ' + data.leads.length) + kpi('Follow-ups complete', followCompleted, 'Internal test tasks') + kpi('Test visits complete', completedVisits, 'No real appointments') + kpi('Open test visits', activeVisits, 'Proposed or scheduled') + kpi('Agent log entries', data.activities.length, 'Stored locally') + '</div>'
      + '<div class="dashboard-grid"><section class="card"><div class="card-head"><h3>Leads by simulated source</h3><span class="subtle">No source is connected</span></div><div class="bars">'
      + Object.keys(sources).map(function (source) { return barRow(source.replace('Simulated ', ''), sources[source], maxSource); }).join('')
      + '</div></section><section class="card"><div class="card-head"><h3>Priority distribution</h3><span class="subtle">Test scoring</span></div><div class="bars">'
      + barRow('HOT', data.leads.filter(function (lead) { return scoreTier(lead) === 'HOT'; }).length, data.leads.length)
      + barRow('WARM', data.leads.filter(function (lead) { return scoreTier(lead) === 'WARM'; }).length, data.leads.length)
      + barRow('COLD', data.leads.filter(function (lead) { return scoreTier(lead) === 'COLD'; }).length, data.leads.length)
      + barRow('DNC protected', data.leads.filter(function (lead) { return lead.dnc; }).length, data.leads.length)
      + '</div></section></div>'
      + '<div class="dashboard-grid"><section class="card"><div class="card-head"><h3>Test property availability</h3><span class="subtle">Matching respects this</span></div><div class="bars">'
      + barRow('Available', data.properties.filter(function (p) { return p.status === 'Available'; }).length, data.properties.length)
      + barRow('On Hold', data.properties.filter(function (p) { return p.status === 'On Hold'; }).length, data.properties.length)
      + barRow('Sold', data.properties.filter(function (p) { return p.status === 'Sold'; }).length, data.properties.length)
      + '</div></section><section class="card"><div class="card-head"><h3>What this report cannot do</h3><span class="tag">OFFLINE</span></div><div class="callout">It does not submit leads, update property portals, message WhatsApp, send email, make calls, schedule external calendars, or use any API key. Export contains only your locally stored test records.</div></section></div>';
  }

  function barRow(label, value, max) {
    var width = max ? Math.round((value / max) * 100) : 0;
    return '<div class="bar-row"><div class="bar-label">' + escapeHtml(label) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div><div class="bar-value">' + value + '</div></div>';
  }

  function option(value, label, selected) {
    return '<option value="' + escapeHtml(value) + '"' + (value === selected ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
  }

  function showModal(title, subtitle, content, large) {
    document.getElementById('modal-root').innerHTML = '<div class="modal-backdrop" data-action="close-modal-backdrop"><section class="modal' + (large ? ' large' : '') + '" role="dialog" aria-modal="true"><div class="modal-head"><div><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(subtitle || '') + '</p></div><button class="close" aria-label="Close" data-action="close-modal">×</button></div>' + content + '</section></div>';
  }

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  function showLeadModal(id) {
    var lead = getLead(id);
    if (!lead) return;
    var matches = getMatches(lead);
    var matchContent = lead.dnc
      ? '<div class="callout">This test lead is protected by Do Not Contact. It is excluded from matching, follow-up creation, and simulations until you allow the test workflow again.</div>'
      : (matches.length ? matches.map(function (match) {
          return '<div class="match-card"><div><strong>' + escapeHtml(match.property.name) + '</strong><br><small>' + escapeHtml(match.property.type) + ' · ' + escapeHtml(match.property.location) + ' · ' + formatMoney(match.property.price) + '</small></div><div class="match-score">' + match.score + '% test match</div></div>';
        }).join('') : '<div class="empty">No Available test property matches this requirement. Try setting a matching property to Available.</div>');
    showModal(lead.name, 'Dummy lead record — not a real customer', ''
      + '<div class="detail-summary"><div class="detail-box"><span>Priority score</span><strong>' + scoreTier(lead) + ' ' + lead.score + '/100</strong></div><div class="detail-box"><span>Requirement</span><strong>' + escapeHtml(lead.type) + ' · ' + escapeHtml(lead.location) + '</strong></div><div class="detail-box"><span>Budget</span><strong>' + formatMoney(lead.budget) + '</strong></div><div class="detail-box"><span>Purpose</span><strong>' + escapeHtml(lead.purpose) + '</strong></div><div class="detail-box"><span>Timeline</span><strong>' + escapeHtml(lead.timeline) + '</strong></div><div class="detail-box"><span>Test stage</span><strong>' + escapeHtml(lead.stage) + '</strong></div></div>'
      + '<h3>Available test-property matches</h3>' + matchContent
      + '<div class="modal-foot"><button class="button secondary" data-action="close-modal">Close</button><button class="button ' + (lead.dnc ? 'primary' : 'danger') + '" data-action="toggle-dnc" data-id="' + lead.id + '">' + (lead.dnc ? 'Allow test workflow' : 'Set Do Not Contact') + '</button></div>', true);
  }

  function showAddLeadModal() {
    showModal('Add a test lead', 'This record stays only in this browser. Do not enter real customer data.', ''
      + '<form id="add-lead-form"><div class="form-grid">'
      + '<label>Test lead label<input name="name" required maxlength="50" placeholder="e.g. Test Lead New Buyer"></label>'
      + '<label>Simulated source<select name="source">' + option('Simulated Meta form', 'Simulated Meta form', 'Simulated Meta form') + option('Simulated property portal', 'Simulated property portal', '') + option('Simulated website form', 'Simulated website form', '') + option('Simulated manual entry', 'Simulated manual entry', '') + '</select></label>'
      + '<label>Property type<select name="type">' + propertyTypeOptions('Flat') + '</select></label>'
      + '<label>Location<select name="location">' + locationOptions('Lake View') + '</select></label>'
      + '<label>Test budget (₹)<input name="budget" type="number" min="1000000" value="6000000" required></label>'
      + '<label>Test score (0–100)<input name="score" type="number" min="0" max="100" value="65" required></label>'
      + '<label>Purpose<select name="purpose">' + option('Personal use', 'Personal use', 'Personal use') + option('Investment', 'Investment', '') + '</select></label>'
      + '<label>Timeline<select name="timeline">' + option('0–3 months', '0–3 months', '') + option('3–6 months', '3–6 months', '3–6 months') + option('6–12 months', '6–12 months', '') + option('12+ months', '12+ months', '') + '</select></label>'
      + '<label class="full">Internal test note<textarea name="note" rows="2" placeholder="Optional local test note — no real contact information"></textarea></label>'
      + '</div><div class="modal-foot"><button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit">Create test lead</button></div></form>');
  }

  function showAddFollowupModal() {
    var validLeads = data.leads.filter(function (lead) { return !lead.dnc; });
    showModal('Create an internal test follow-up', 'This creates a local task only; it cannot send messages or calls.', ''
      + '<form id="add-followup-form"><div class="form-grid"><label class="full">Test lead<select name="leadId">' + validLeads.map(function (lead) { return option(lead.id, lead.name + ' — ' + scoreTier(lead), lead.id); }).join('') + '</select></label><label>Test due label<input name="due" value="Test Day 2 · 11:00" required></label><label>Owner<select name="owner">' + option('Follow-up Agent', 'Follow-up Agent', 'Follow-up Agent') + option('AI Sales Manager', 'AI Sales Manager', '') + option('Manual test review', 'Manual test review', '') + '</select></label><label class="full">Internal task note<textarea name="note" rows="3" required placeholder="For example: Verify queue behavior only"></textarea></label></div><div class="modal-foot"><button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit">Add test task</button></div></form>');
  }

  function showAddVisitModal() {
    var validLeads = data.leads.filter(function (lead) { return !lead.dnc; });
    var available = availableProperties();
    showModal('Schedule a test site visit', 'This creates a local test record, never a calendar event or real appointment.', ''
      + '<form id="add-visit-form"><div class="form-grid"><label>Test lead<select name="leadId">' + validLeads.map(function (lead) { return option(lead.id, lead.name + ' — ' + lead.type, lead.id); }).join('') + '</select></label><label>Available test property<select name="propertyId">' + available.map(function (property) { return option(property.id, property.name + ' — ' + property.type, property.id); }).join('') + '</select></label><label>Test date/time label<input name="when" value="Test Day 2 · 15:00" required></label><label>Status<select name="status">' + option('Proposed', 'Proposed (internal approval)', 'Proposed') + option('Scheduled', 'Scheduled (test only)', 'Scheduled') + '</select></label><label class="full">Internal note<textarea name="note" rows="3" required placeholder="For example: Test visit workflow"></textarea></label></div><div class="modal-foot"><button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit">Create test visit</button></div></form>');
  }

  function propertyTypeOptions(selected) {
    return ['Flat', 'Villa', 'Plot', 'Commercial', 'Land'].map(function (value) { return option(value, value, selected); }).join('');
  }

  function locationOptions(selected) {
    return ['Lake View', 'Central Avenue', 'West Park', 'Green Meadows', 'Tech Square', 'Riverside'].map(function (value) { return option(value, value, selected); }).join('');
  }

  function toast(message, isError) {
    var node = document.getElementById('toast');
    node.textContent = message;
    node.classList.toggle('error', Boolean(isError));
    node.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { node.classList.add('hidden'); }, 4200);
  }

  function runSimulation() {
    var eligible = data.leads.filter(function (lead) { return !lead.dnc; }).sort(function (a, b) { return b.score - a.score; });
    var lead = eligible[0];
    if (!lead) {
      toast('No eligible dummy lead is available for the simulation.', true);
      return;
    }
    var active = data.agents.filter(function (agent) { return agent.status === 'Active'; });
    active.forEach(function (agent) {
      agent.processed += 1;
      if (scoreTier(lead) === 'HOT') agent.hot += 1;
    });
    lead.stage = scoreTier(lead) === 'HOT' ? 'Simulated priority review' : 'Simulated workflow review';
    addActivity('A-01', 'Lead Capture Agent processed ' + lead.name, 'Read a local dummy record; no source connection or contact occurred.');
    addActivity('A-03', 'Lead Scoring Agent confirmed ' + scoreTier(lead) + ' score ' + lead.score, 'Scoring used local test fields only.');
    var matches = getMatches(lead);
    addActivity('A-09', 'Property Matching Agent found ' + matches.length + ' Available test match(es)', 'On Hold and Sold inventory remains excluded from matching.');
    if ((scoreTier(lead) === 'HOT' || scoreTier(lead) === 'WARM') && !data.followups.some(function (item) { return item.leadId === lead.id && item.status !== 'Completed'; })) {
      data.followups.push({ id: nextId('F', data.followups), leadId: lead.id, due: 'Test Day 2 · 10:00', owner: 'Follow-up Agent', note: 'Created by safe workflow simulation', status: 'Scheduled' });
      addActivity('A-06', 'Follow-up Agent created an internal test task', 'The task is local only; no communication was sent.');
    }
    if (scoreTier(lead) === 'HOT' && matches.length && !data.visits.some(function (visit) { return visit.leadId === lead.id && visit.status !== 'Completed'; })) {
      data.visits.push({ id: nextId('V', data.visits), leadId: lead.id, propertyId: matches[0].property.id, when: 'Test Day 3 · 11:30', status: 'Proposed', note: 'Created by safe workflow simulation' });
      addActivity('A-07', 'Site Visit Agent prepared an internal test proposal', 'This is not a real appointment or calendar booking.');
    }
    addActivity('A-10', 'AI Sales Manager refreshed the simulated priority list', 'Internal recommendation only; no external action can occur.');
    saveData();
    render();
    toast('Safe simulation complete: local records and agent log updated. No communication was sent.');
  }

  function nextId(prefix, collection) {
    var max = collection.reduce(function (highest, item) {
      var number = parseInt(String(item.id).replace(/[^0-9]/g, ''), 10);
      return Math.max(highest, number || 0);
    }, 0);
    return prefix + '-' + String(max + 1).padStart(3, '0');
  }

  function toggleDnc(id) {
    var lead = getLead(id);
    if (!lead) return;
    lead.dnc = !lead.dnc;
    lead.stage = lead.dnc ? 'Do not contact' : 'Ready for test workflow';
    addActivity('A-10', lead.dnc ? 'AI Sales Manager protected a test lead with Do Not Contact' : 'AI Sales Manager reopened a test lead for local workflow', lead.name + ' was ' + (lead.dnc ? 'excluded from' : 'allowed in') + ' matching and simulations. No contact occurred.');
    saveData();
    closeModal();
    render();
    toast(lead.dnc ? 'Do Not Contact is on. The dummy lead is now excluded from matches and new tasks.' : 'The dummy lead is eligible for local test workflows again.');
  }

  function updatePropertyStatus(id, status) {
    var property = getProperty(id);
    if (!property) return;
    property.status = status;
    addActivity('A-09', 'Property Matching Agent refreshed inventory after status change', property.name + ' is now ' + status + ' in local test data and ' + (status === 'Available' ? 'eligible for' : 'excluded from') + ' matching.');
    saveData();
    render();
    toast(property.name + ' is now ' + status + ' in the local test inventory.');
  }

  function completeFollowup(id) {
    var item = data.followups.find(function (followup) { return followup.id === id; });
    if (!item || item.status === 'Completed') return;
    item.status = 'Completed';
    addActivity('A-06', 'Follow-up Agent completed an internal test task', 'Marked ' + item.id + ' complete locally. No communication was sent.');
    saveData();
    render();
    toast('Test follow-up marked complete. No message or call was sent.');
  }

  function completeVisit(id) {
    var visit = data.visits.find(function (item) { return item.id === id; });
    if (!visit || visit.status === 'Completed') return;
    visit.status = 'Completed';
    addActivity('A-07', 'Site Visit Agent completed a test visit record', 'Marked ' + visit.id + ' complete locally. No calendar or real visit was created.');
    saveData();
    render();
    toast('Test site visit marked complete locally.');
  }

  function setAgentStatus(id, status) {
    var agent = getAgent(id);
    if (!agent || agent.status === status) return;
    agent.status = status;
    agent.task = status === 'Paused' ? 'Paused by test operator' : 'Ready for safe local test work';
    addActivity(agent.id, agent.name + ' was set to ' + status, 'Control changed only inside this offline Test Mode package.');
    saveData();
    render();
    toast(agent.name + ' is now ' + status + ' in Test Mode.');
  }

  function testAgent(id) {
    var agent = getAgent(id);
    if (!agent) return;
    if (agent.status === 'Paused') {
      toast(agent.name + ' is paused. Turn it on first to run a local test action.', true);
      return;
    }
    agent.processed += 1;
    agent.task = 'Completed a safe local test action';
    addActivity(agent.id, agent.name + ' completed a test action', 'A local activity entry was created. No real system, message, call, or account was used.');
    saveData();
    render();
    toast(agent.name + ' completed a safe local test action.');
  }

  function exportData() {
    var exportObject = {
      exportedAt: new Date().toISOString(),
      safety: 'TEST DATA ONLY. No real customer data, APIs, or communications.',
      data: data
    };
    var blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'realestate-ai-test-mode-export.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    toast('Local test-data export downloaded.');
  }

  function resetData() {
    if (!window.confirm('Reset all private Test Mode changes and restore the 20 sample leads? This affects only the dummy data in this portal.')) return;
    requestServer('POST', '/api/reset', {})
      .then(function (response) {
        if (!response.ok) throw new Error('reset failed');
        return response.json();
      })
      .then(function (payload) {
        data = payload.state;
        leadFilter = { search: '', tier: 'ALL', dnc: 'ALL' };
        closeModal();
        render();
        toast('The private Test Mode dataset has been restored.');
      })
      .catch(function () {
        toast('The server could not reset the Test Mode data.', true);
      });
  }

  function handleFormSubmit(event) {
    var form = event.target;
    if (form.id === 'login-form') {
      event.preventDefault();
      var username = document.getElementById('username').value.trim();
      var password = document.getElementById('password').value;
      requestServer('POST', '/api/auth/login', { username: username, password: password })
        .then(function (response) {
          return response.json().then(function (payload) {
            if (!response.ok) throw new Error(payload.error || 'Unable to sign in.');
            return payload;
          });
        })
        .then(function (payload) {
          document.getElementById('password').value = '';
          openPortal(payload);
          toast('Signed in to the private TEST portal. All workflows remain simulated.');
        })
        .catch(function (error) {
          toast(error.message || 'Unable to sign in to the private server.', true);
        });
      return;
    }
    if (form.id === 'lead-filter') {
      event.preventDefault();
      var fields = new FormData(form);
      leadFilter = { search: fields.get('search').trim(), tier: fields.get('tier'), dnc: fields.get('dnc') };
      render();
      return;
    }
    if (form.id === 'property-form') {
      event.preventDefault();
      savePropertyForm(form).catch(function (error) { toast(error.message, true); });
      return;
    }
    if (form.id === 'add-lead-form') {
      event.preventDefault();
      var values = new FormData(form);
      var score = Math.max(0, Math.min(100, Number(values.get('score')) || 0));
      var lead = {
        id: nextId('L', data.leads),
        name: values.get('name').trim().indexOf('Test') === 0 ? values.get('name').trim() : 'Test Lead ' + values.get('name').trim(),
        source: values.get('source'),
        type: values.get('type'),
        location: values.get('location'),
        budget: Number(values.get('budget')) || 0,
        purpose: values.get('purpose'),
        timeline: values.get('timeline'),
        score: score,
        stage: 'New local test record',
        dnc: false,
        created: 'Test session'
      };
      data.leads.push(lead);
      addActivity('A-01', 'Lead Capture Agent logged a new dummy lead', lead.name + ' was created locally with no contact details or external submission.');
      if (values.get('note').trim()) addActivity('A-10', 'AI Sales Manager stored an internal test note', values.get('note').trim());
      saveData();
      closeModal();
      setView('leads');
      toast('New dummy lead created locally.');
      return;
    }
    if (form.id === 'add-followup-form') {
      event.preventDefault();
      var followup = new FormData(form);
      data.followups.push({ id: nextId('F', data.followups), leadId: followup.get('leadId'), due: followup.get('due').trim(), owner: followup.get('owner'), note: followup.get('note').trim(), status: 'Scheduled' });
      addActivity('A-06', 'Follow-up Agent created an internal test task', 'Created a local task for ' + leadName(followup.get('leadId')) + '. No communication was sent.');
      saveData();
      closeModal();
      setView('followups');
      toast('Internal test follow-up created.');
      return;
    }
    if (form.id === 'add-visit-form') {
      event.preventDefault();
      var visit = new FormData(form);
      data.visits.push({ id: nextId('V', data.visits), leadId: visit.get('leadId'), propertyId: visit.get('propertyId'), when: visit.get('when').trim(), status: visit.get('status'), note: visit.get('note').trim() });
      addActivity('A-07', 'Site Visit Agent created an internal test record', 'Created locally for ' + leadName(visit.get('leadId')) + '. No appointment or calendar event was created.');
      saveData();
      closeModal();
      setView('visits');
      toast('Test site visit created locally.');
    }
  }

  function handleClick(event) {
    var nav = event.target.closest('.nav-item');
    if (nav) {
      setView(nav.getAttribute('data-view'));
      return;
    }
    var target = event.target.closest('[data-action]');
    if (!target) return;
    var action = target.getAttribute('data-action');
    if (action === 'toggle-menu') document.querySelector('.sidebar').classList.toggle('open');
    else if (action === 'logout') {
      requestServer('POST', '/api/auth/logout', {})
        .catch(function () {
          /* Clear this browser view even if the private server is temporarily unavailable. */
        })
        .then(function () {
          csrfToken = '';
          data = deepClone(SEED);
          document.getElementById('portal').classList.add('hidden');
          document.getElementById('login-screen').classList.remove('hidden');
          document.getElementById('password').value = '';
          closeModal();
        });
    } else if (action === 'show-view') setView(target.getAttribute('data-view'));
    else if (action === 'run-simulation') runSimulation();
    else if (action === 'export-data') exportData();
    else if (action === 'reset-data') resetData();
    else if (action === 'view-lead') showLeadModal(target.getAttribute('data-id'));
    else if (action === 'toggle-dnc') toggleDnc(target.getAttribute('data-id'));
    else if (action === 'open-add-lead') showAddLeadModal();
    else if (action === 'open-add-followup') showAddFollowupModal();
    else if (action === 'open-add-visit') showAddVisitModal();
    else if (action === 'complete-followup') completeFollowup(target.getAttribute('data-id'));
    else if (action === 'complete-visit') completeVisit(target.getAttribute('data-id'));
    else if (action === 'set-agent-status') setAgentStatus(target.getAttribute('data-id'), target.getAttribute('data-status'));
    else if (action === 'test-agent') testAgent(target.getAttribute('data-id'));
    else if (action === 'clear-lead-filters') {
      leadFilter = { search: '', tier: 'ALL', dnc: 'ALL' };
      render();
    } else if (action === 'inbox-refresh') loadInbox();
    else if (action === 'parse-ingest') previewIngest();
    else if (action === 'ingest-paste') submitIngest();
    else if (action === 'create-ai-draft') createAiDraft();
    else if (action === 'approve-outbox') outboxAction('approve', target.getAttribute('data-id'));
    else if (action === 'reject-outbox') outboxAction('reject', target.getAttribute('data-id'));
    else if (action === 'open-add-property') showPropertyFormModal();
    else if (action === 'view-property') showPropertyModal(target.getAttribute('data-id'));
    else if (action === 'edit-property') showPropertyFormModal(target.getAttribute('data-id'));
    else if (action === 'send-property') sendPropertyAttachment(target.getAttribute('data-id'), target.getAttribute('data-attach'));
    else if (action === 'parse-geo') {
      var geoText = document.getElementById('geo-input') ? document.getElementById('geo-input').value : '';
      var parsed = parseGeoInput(geoText);
      if (!parsed) {
        toast('Pin nahi mila. Poora Google Maps link paste karo (Share → Copy link), ya lat,lng khud likho.', true);
      } else {
        geoDraft = parsed;
        document.getElementById('geo-lat').value = parsed.lat;
        document.getElementById('geo-lng').value = parsed.lng;
        document.getElementById('geo-status').innerHTML = '📍 Pin set: ' + parsed.lat + ', ' + parsed.lng;
        renderGeoMapPreview();
        toast('📍 Location pin mil gaya!');
      }
    }
    else if (action === 'clear-geo') {
      geoDraft = null;
      if (document.getElementById('geo-input')) document.getElementById('geo-input').value = '';
      if (document.getElementById('geo-lat')) document.getElementById('geo-lat').value = '';
      if (document.getElementById('geo-lng')) document.getElementById('geo-lng').value = '';
      if (document.getElementById('geo-status')) document.getElementById('geo-status').textContent = 'Abhi koi pin nahi.';
      renderGeoMapPreview();
    }
    else if (action === 'drop-pending-photo') {
      pendingPhotos.splice(Number(target.getAttribute('data-index')), 1);
      renderPendingPhotos();
    }
    else if (action === 'remove-photo') {
      var removePropertyId = target.getAttribute('data-id');
      var removeMediaId = target.getAttribute('data-media');
      requestServer('DELETE', '/api/properties/' + removePropertyId + '/photos/' + removeMediaId, undefined)
        .then(function (response) { return response.json().then(function (payload) { if (!response.ok) throw new Error(payload.error || 'Photo delete nahi hui.'); return payload; }); })
        .then(function () { toast('Photo hata di.'); return refreshState().then(function () { showPropertyFormModal(removePropertyId); }); })
        .catch(function (error) { toast(error.message, true); });
    }
    else if (action === 'copy-share-link') {
      var shareId = target.getAttribute('data-id');
      copyText(location.origin + '/p/' + shareId, '🔗 Client link copy ho gaya — WhatsApp par bhej sakte ho.');
    }
    else if (action === 'open-lightbox') openLightbox(target.getAttribute('data-src'));
    else if (action === 'close-lightbox') closeLightbox();
    else if (action === 'close-modal') closeModal();
    else if (action === 'close-modal-backdrop' && event.target === target) closeModal();
  }

  function handleChange(event) {
    var target = event.target;
    if (target.getAttribute('data-action') === 'change-property-status') {
      updatePropertyStatus(target.getAttribute('data-id'), target.value);
      return;
    }
    if (target.id === 'photo-input') {
      handlePhotoPick(target);
    }
  }


  // ─────────────────────────────────────────────────────────────
  //  Inbox & Approvals — outbound messaging with human review
  // ─────────────────────────────────────────────────────────────
  var inboxCache = { items: [], stats: {}, status: null };

  function badge(text, tone) {
    var colors = {
      draft: 'background:#2a2417;color:#ffe4a3;border:1px solid #6b5a20',
      dry_run: 'background:#131f2e;color:#9dc6ff;border:1px solid #2a4a6b',
      sent: 'background:#132a1c;color:#8ef0b0;border:1px solid #245c39',
      blocked: 'background:#2a1717;color:#ff9d9d;border:1px solid #5a2b2b',
      rejected: 'background:#1a1f2e;color:#93a1bd;border:1px solid #26304d',
      failed: 'background:#2a1717;color:#ff9d9d;border:1px solid #5a2b2b'
    };
    return '<span style="font-size:11px;padding:3px 9px;border-radius:999px;' + (colors[tone] || colors.rejected) + '">' + escapeHtml(text) + '</span>';
  }

  function channelLabel(channel) {
    return channel === 'whatsapp' ? '🟢 WhatsApp' : '🟣 Instagram';
  }

  function renderInbox() {
    var leadOptions = data.leads.map(function (lead) {
      return option(lead.id, lead.name + ' — ' + scoreTier(lead) + ' · ' + lead.type + ' · ' + lead.location, data.leads[0] && data.leads[0].id);
    }).join('');
    return ''
      + '<div class="view-header"><div><h2>Inbox &amp; approvals</h2><p>AI replies draft hoti hain — koi message insaan ke <b>Approve</b> karne se pehle bahar nahi jaata. TEST mode me approve karne par bhi sirf DRY RUN hota hai.</p></div>'
      + '<button class="button secondary small" data-action="inbox-refresh">↻ Refresh</button></div>'
      + '<section class="card"><div class="card-head"><h3>Integration status</h3></div><div id="int-status" class="mut">Loading…</div></section>'
      + '<section class="card"><div class="card-head"><h3>🤖 AI se draft banao</h3></div>'
      +   '<div class="form-grid">'
      +     '<label>Lead<select id="draft-lead">' + leadOptions + '</select></label>'
      +     '<label>Channel<select id="draft-channel">' + option('whatsapp', 'WhatsApp', 'whatsapp') + option('instagram', 'Instagram', 'whatsapp') + '</select></label>'
      +     '<label class="full">Customer ka message (paste karo)<textarea id="draft-inbound" rows="3" placeholder="Sir price kya hai? Site visit kab ho sakti hai? Photo aur location bhejo"></textarea></label>'
      +     '<label>Property (photo / location ke liye)<select id="draft-property">'
      +       '<option value="">Auto — lead se best match</option>'
      +       data.properties.map(function (p) {
              return option(p.id, p.name + ' · ' + p.type + (p.photos && p.photos.length ? ' 📷' + p.photos.length : '') + (p.geo ? ' 📍' : ''), '');
            }).join('')
      +     '</select></label>'
      +     '<label>Kya bhejna hai<select id="draft-attach">'
      +       option('auto', 'Auto — message padh ke decide karo', 'auto')
      +       option('both', 'Photos + Location dono', '')
      +       option('photos', 'Sirf photos', '')
      +       option('location', 'Sirf location pin', '')
      +       option('none', 'Sirf text (kuch nahi)', '')
      +     '</select></label>'
      +   '</div>'
      +   '<div class="modal-foot" style="justify-content:flex-start"><button class="button primary" data-action="create-ai-draft">🤖 Draft banao (approval ke liye)</button></div>'
      + '</section>'
      + '<section class="card"><div class="card-head"><h3>🔗 Contact link karo (consent record)</h3></div>'
      +   '<form id="contact-form"><div class="form-grid">'
      +     '<label>Lead<select name="leadId">' + leadOptions + '</select></label>'
      +     '<label>Channel<select name="channel">' + option('whatsapp', 'WhatsApp', 'whatsapp') + option('instagram', 'Instagram', 'whatsapp') + '</select></label>'
      +     '<label>Handle / number<input name="handle" placeholder="+919876543210" required></label>'
      +     '<label>Consent ka source<input name="consentSource" placeholder="customer ne khud message kiya / website form"></label>'
      +   '</div><div class="modal-foot" style="justify-content:flex-start"><button class="button secondary" type="submit">Consent ke saath link karo</button></div></form>'
      +   '<p class="mut" style="font-size:12px;margin-top:8px">Bina consent ke koi message nahi jaayega — safety layer ye check karti hai.</p>'
      + '</section>'
      + '<section class="card"><div class="card-head"><h3>📥 Lead ingest — portal email se lead pakdo</h3></div>'
      +   '<p class="mut" style="font-size:12px;margin:0 0 10px">99acres / MagicBricks ka lead-notification email yahan paste karo — parser name, phone, budget, requirement nikaal ke CRM me daal dega. '
      +     'Automation ke liye webhook endpoint bhi ready hai (<code>POST /api/leads/ingest</code>, header <code>X-Ingest-Token</code>).</p>'
      +   '<div class="form-grid">'
      +     '<label class="full">Email yahan paste karo (subject + body)<textarea id="ingest-paste" rows="6" placeholder="Subject: New Lead: 3 BHK Apartment in Vaishali Nagar, Jaipur&#10;From: noreply@99acres.com&#10;&#10;Name: Rahul Sharma&#10;Mobile: +91 98765 43210&#10;Budget: 75 Lakh - 90 Lakh&#10;Message: Please contact me"></textarea></label>'
      +   '</div>'
      +   '<div class="modal-foot" style="justify-content:flex-start;gap:8px">'
      +     '<button class="button secondary" data-action="parse-ingest">👁 Preview (parse karke dikhao)</button>'
      +     '<button class="button primary" data-action="ingest-paste">📥 Parse + CRM me daalo</button>'
      +   '</div>'
      +   '<div id="ingest-preview" style="margin-top:10px"></div>'
      + '</section>'
      + '<section class="card"><div class="card-head"><h3>📬 Outbox (approval queue)</h3></div><div id="inbox-list" class="mut">Loading…</div></section>';
  }

  function attachmentBlock(meta) {
    var attachments = meta && meta.attachments;
    if (!attachments) return '';
    var chips = [];
    if (attachments.photos && attachments.photos.length) chips.push('📷 ' + attachments.photos.length + ' photo' + (attachments.photos.length > 1 ? 's' : ''));
    if (attachments.location) chips.push('📍 ' + escapeHtml(attachments.location.area || attachments.location.label || 'location pin'));
    if (!chips.length) return '';
    var thumbs = (attachments.photos || []).map(function (photo) {
      return '<button type="button" class="outbox-thumb" data-action="open-lightbox" data-src="' + photoUrl(photo) + '"><img src="' + photoUrl(photo) + '" alt="photo"></button>';
    }).join('');
    return '<div class="attach-row"><span class="attach-chip">' + escapeHtml((attachments.propertyName ? attachments.propertyName + ' · ' : '') + chips.join(' + ')) + '</span>'
      + (thumbs ? '<span class="attach-thumbs">' + thumbs + '</span>' : '') + '</div>';
  }

  function loadInbox() {
    var listNode = document.getElementById('inbox-list');
    requestServer('GET', '/api/outbox')
      .then(function (response) { return response.json(); })
      .then(function (payload) {
        if (payload.error) throw new Error(payload.error);
        inboxCache = payload;
        var statusNode = document.getElementById('int-status');
        if (statusNode && payload.status) {
          var channels = payload.status.channels;
          statusNode.innerHTML = '<div style="font-size:13px;line-height:1.9">'
            + 'Mode: <b style="color:' + (payload.status.live ? '#ff9d9d' : '#8ef0b0') + '">' + escapeHtml(payload.status.mode) + '</b>'
            + ' · Approval required: <b>' + (payload.status.approvalRequired ? 'yes' : 'no') + '</b>'
            + ' · Webhook signature: <b>' + (payload.status.webhookSignatureCheck ? 'on' : 'off') + '</b><br>'
            + '🟢 WhatsApp: <b>' + (channels.whatsapp.ready ? 'configured' : 'not configured') + '</b> <span class="mut">(' + escapeHtml(channels.whatsapp.reason) + ')</span><br>'
            + '🟣 Instagram: <b>' + (channels.instagram.ready ? 'configured' : 'not configured') + '</b> <span class="mut">(' + escapeHtml(channels.instagram.reason) + ')</span><br>'
            + '🤖 LLM: <b>' + (channels.llm.ready ? 'ready (' + escapeHtml(channels.llm.provider) + (channels.llm.provider === 'mock' ? ' — offline template' : ' · ' + escapeHtml(channels.llm.model)) + ')' : 'not configured') + '</b>'
            + '</div>';
        }
        var stats = payload.stats || {};
        var statsLine = Object.keys(stats).length
          ? Object.keys(stats).map(function (k) { return badge(k + ' · ' + stats[k], k); }).join(' ')
          : '<span class="mut">Queue khaali hai.</span>';
        var rows = (payload.items || []).map(function (item) {
          var buttons = '';
          if (item.status === 'draft') {
            buttons = '<button class="button primary small" data-action="approve-outbox" data-id="' + item.id + '">✅ Approve &amp; send</button> '
                    + '<button class="button secondary small" data-action="reject-outbox" data-id="' + item.id + '">✖ Reject</button>';
          }
          return '<div style="border:1px solid #26304d;border-radius:12px;padding:12px;margin-bottom:10px;background:#0f1526">'
            + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">'
            + '<div><b>' + escapeHtml(item.lead_name || item.lead_id) + '</b> <span class="mut">· ' + channelLabel(item.channel) + ' → ' + escapeHtml(item.to_handle || '(no contact)') + '</span></div>'
            + '<div>' + badge(item.status, item.status) + (item.ai_generated ? ' ' + badge('AI', 'rejected') : '') + '</div></div>'
            + attachmentBlock(item.meta)
            + '<p style="margin:8px 0;font-size:13px;line-height:1.6">' + escapeHtml(item.body) + '</p>'
            + (item.blocked_reason ? '<p style="color:#ff9d9d;font-size:12px;margin:6px 0">🚫 ' + escapeHtml(item.blocked_reason) + '</p>' : '')
            + '<div class="mut" style="font-size:11px;margin-bottom:8px">' + escapeHtml(String(item.created_at).slice(0, 16)) + ' · by ' + escapeHtml(item.created_by || '') + (item.approved_by ? ' · approved by ' + escapeHtml(item.approved_by) : '') + '</div>'
            + buttons + '</div>';
        }).join('');
        listNode.innerHTML = '<div style="margin-bottom:10px">' + statsLine + '</div>' + (rows || '<span class="mut">Abhi koi draft nahi. Upar se AI draft banao ya webhook se inbound message bhejo.</span>');
      })
      .catch(function (error) {
        if (listNode) listNode.innerHTML = '<span style="color:#ff9d9d">' + escapeHtml(error.message || 'Inbox load nahi hui.') + '</span>';
      });
  }

  function createAiDraft() {
    var leadSelect = document.getElementById('draft-lead');
    var channelSelect = document.getElementById('draft-channel');
    var inboundNode = document.getElementById('draft-inbound');
    if (!leadSelect) return;
    var propertySelect = document.getElementById('draft-property');
    var attachSelect = document.getElementById('draft-attach');
    requestServer('POST', '/api/outbox/ai-draft', {
      leadId: leadSelect.value,
      channel: channelSelect ? channelSelect.value : 'whatsapp',
      inbound: inboundNode ? inboundNode.value : '',
      propertyId: propertySelect ? propertySelect.value : '',
      attach: attachSelect ? attachSelect.value : 'auto'
    })
      .then(function (response) { return response.json().then(function (payload) { if (!response.ok) throw new Error(payload.error || 'Draft failed.'); return payload; }); })
      .then(function (payload) {
        toast(payload.item.status === 'blocked' ? 'Draft bani lekin BLOCKED: ' + payload.item.blocked_reason : 'AI draft ready — neeche outbox me approve karo (nothing sent automatically).');
        if (inboundNode) inboundNode.value = '';
        loadInbox();
      })
      .catch(function (error) { toast(error.message, true); });
  }

  function outboxAction(kind, id) {
    requestServer('POST', '/api/outbox/' + id + '/' + kind, {})
      .then(function (response) { return response.json().then(function (payload) { if (!response.ok) throw new Error(payload.error || 'Action failed.'); return payload; }); })
      .then(function (payload) {
        if (kind === 'approve') {
          toast(payload.dryRun ? '✅ Approved — DRY RUN (TEST mode): message actually bheja nahi gaya.' : '✅ Approved and sent.');
        } else {
          toast('Draft reject kar diya.');
        }
        loadInbox();
      })
      .catch(function (error) { toast(error.message, true); });
  }


  function emailFromPaste(pasted) {
    var text = pasted || '';
    var subjectMatch = text.match(/^\s*subject\s*[:\-]\s*(.+)$/im);
    var fromMatch = text.match(/^\s*from\s*[:\-]\s*(.+)$/im);
    var body = text
      .replace(/^\s*subject\s*[:\-].*$/im, '')
      .replace(/^\s*from\s*[:\-].*$/im, '')
      .trim();
    return { subject: subjectMatch ? subjectMatch[1].trim() : '', from: fromMatch ? fromMatch[1].trim() : '', text: body };
  }

  function renderParsedPreview(parsed) {
    var rows = [
      ['Source', parsed.source], ['Name', parsed.name],
      ['Phone', parsed.phone ? (parsed.phoneMasked ? parsed.phone + ' (masked — portal me dekho)' : '+' + parsed.phone) : '—'],
      ['Type', parsed.propertyType || '—'], ['Location', parsed.location || '—'],
      ['Budget', parsed.budget ? ('\u20b9' + (parsed.budget.min === parsed.budget.max ? '' : '') + (parsed.budget.min / 100000).toFixed(0) + (parsed.budget.min !== parsed.budget.max ? ' - ' + (parsed.budget.max / 100000).toFixed(0) : '') + ' Lakh') : '—'],
      ['Timeline', parsed.timeline || '—'], ['Purpose', parsed.purpose || '—'],
      ['Reference', parsed.reference || '—'], ['Confidence', parsed.confidence + '%']
    ];
    return '<div style="background:#0f1526;border:1px solid #26304d;border-radius:12px;padding:12px;font-size:12.5px;line-height:1.9">'
      + rows.map(function (pair) { return '<div><span class="mut">' + pair[0] + ':</span> <b>' + escapeHtml(String(pair[1] === null || pair[1] === undefined ? '—' : pair[1])) + '</b></div>'; }).join('')
      + (parsed.message ? '<div style="margin-top:6px" class="mut">"' + escapeHtml(parsed.message) + '"</div>' : '')
      + '</div>';
  }

  function previewIngest() {
    var box = document.getElementById('ingest-paste');
    var out = document.getElementById('ingest-preview');
    if (!box || !out) return;
    requestServer('POST', '/api/leads/parse', { email: emailFromPaste(box.value) })
      .then(function (response) { return response.json().then(function (payload) { if (!response.ok) throw new Error(payload.error || 'Parse failed.'); return payload; }); })
      .then(function (payload) { out.innerHTML = renderParsedPreview(payload.parsed); })
      .catch(function (error) { out.innerHTML = '<span style="color:#ff9d9d">' + escapeHtml(error.message) + '</span>'; });
  }

  function submitIngest() {
    var box = document.getElementById('ingest-paste');
    var out = document.getElementById('ingest-preview');
    if (!box) return;
    var email = emailFromPaste(box.value);
    if (!email.text && !email.subject) { toast('Pehle email paste karo.', true); return; }
    requestServer('POST', '/api/leads/ingest-session', { email: email })
      .then(function (response) { return response.json().then(function (payload) { if (!response.ok) throw new Error(payload.error || 'Ingest failed.'); return payload; }); })
      .then(function (result) {
        var tone = result.status === 'accepted' ? '#8ef0b0' : '#ffe4a3';
        out.innerHTML = '<div style="background:#0f1526;border:1px solid #26304d;border-radius:12px;padding:12px;font-size:12.5px;line-height:1.8">'
          + '<b style="color:' + tone + '">' + (result.status === 'accepted' ? '✅ Lead ban gaya' : '⚠️ Duplicate mila') + '</b><br>'
          + escapeHtml(result.note || '') + '<br>'
          + (result.leadId ? '<span class="mut">Lead ID:</span> <b>' + escapeHtml(result.leadId) + '</b> ' : '')
          + (result.followupId ? '<span class="mut">Follow-up:</span> <b>' + escapeHtml(result.followupId) + '</b> ' : '')
          + (result.consentRecorded ? '<span class="mut">Consent:</span> <b>recorded ✅</b>' : '<span class="mut">Consent:</span> number masked — portal se dekho')
          + '</div>';
        toast(result.status === 'accepted'
          ? 'Lead ' + result.leadId + ' CRM me aa gaya — Leads tab me dekho.'
          : result.note);
        box.value = '';
      })
      .catch(function (error) { toast(error.message, true); });
  }

  function handleContactSubmit(event) {
    if (event.target.id !== 'contact-form') return;
    event.preventDefault();
    var form = event.target;
    requestServer('POST', '/api/contacts', {
      leadId: form.leadId.value,
      channel: form.channel.value,
      handle: form.handle.value,
      consentSource: form.consentSource.value || 'manual-test-consent'
    })
      .then(function (response) { return response.json().then(function (payload) { if (!response.ok) throw new Error(payload.error || 'Save failed.'); return payload; }); })
      .then(function (payload) {
        toast('Contact link ho gaya (' + payload.contact.handle + ') — ab is lead ke liye message ja sakta hai.');
        form.reset();
      })
      .catch(function (error) { toast(error.message, true); });
  }

  document.addEventListener('submit', handleFormSubmit);
  document.addEventListener('submit', handleContactSubmit);
  document.addEventListener('click', handleClick);
  document.addEventListener('change', handleChange);

  render();
  restoreSession();
}());
