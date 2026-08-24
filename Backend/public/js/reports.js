// reports.js
async function loadReports(container) {
    container.innerHTML = `
        <div class="table-container">
            <h3>Reports</h3>
            <p>Reports dashboard coming soon...</p>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; margin-top:20px;">
                <div class="stat-card"><div class="icon">📊</div><div class="label">Inbound Report</div></div>
                <div class="stat-card"><div class="icon">📈</div><div class="label">Outbound Report</div></div>
                <div class="stat-card"><div class="icon">🚚</div><div class="label">Delivery Report</div></div>
            </div>
        </div>
    `;
}