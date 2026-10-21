function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export function downloadVehicleReceipt(reservation) {
  const receiptDate = reservation.vehicle_received_at
    ? new Date(`${reservation.vehicle_received_at.replace(' ', 'T')}Z`).toLocaleString('pt-MZ')
    : '';
  const html = `<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Comprovativo de receção ${escapeHtml(reservation.reference_code)} — Lava Já Matola</title>
    <style>
      body { margin: 0; padding: 32px 16px; background: #f1f5f9; color: #0f172a; font: 15px/1.5 Arial, sans-serif; }
      main { box-sizing: border-box; max-width: 680px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 18px; background: white; }
      h1 { margin: 4px 0 24px; font-size: 25px; }
      .brand { color: #2563eb; font-size: 12px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; }
      .details { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 18px; border-radius: 14px; background: #f8fafc; }
      .field span { display: block; color: #64748b; font-size: 13px; }
      .field strong { display: block; overflow-wrap: anywhere; }
      .notice { margin: 20px 0 0; padding: 16px; border: 1px solid #bfdbfe; border-radius: 14px; background: #eff6ff; color: #1e3a8a; }
      .print { display: block; margin: 22px auto 0; padding: 12px 20px; border: 0; border-radius: 10px; background: #2563eb; color: white; font-size: 15px; font-weight: 700; cursor: pointer; }
      @media (max-width: 480px) { .details { grid-template-columns: 1fr; } main { padding: 22px; } }
      @media print { body { padding: 0; background: white; } main { max-width: none; border: 0; } .print { display: none; } }
    </style>
  </head>
  <body>
    <main>
      <div class="brand">Lava Já Matola</div>
      <h1>Comprovativo de receção da viatura</h1>
      <section class="details">
        <div class="field"><span>Referência</span><strong>${escapeHtml(reservation.reference_code)}</strong></div>
        <div class="field"><span>Cliente</span><strong>${escapeHtml(reservation.customer_name)}</strong></div>
        <div class="field"><span>Matrícula</span><strong>${escapeHtml(reservation.vehicle_plate)}</strong></div>
        <div class="field"><span>Viatura</span><strong>${escapeHtml(reservation.vehicle_model)}</strong></div>
        <div class="field"><span>Serviço</span><strong>${escapeHtml(reservation.service_name)}</strong></div>
        <div class="field"><span>Recebida por</span><strong>${escapeHtml(reservation.vehicle_received_by_name || 'Funcionário')}</strong></div>
        <div class="field"><span>Data e hora da receção</span><strong>${escapeHtml(receiptDate)}</strong></div>
      </section>
      <p class="notice">Este documento confirma que a viatura foi recebida para lavagem. Não é um comprovativo de pagamento nem confirma a conclusão do serviço.</p>
      <button class="print" onclick="window.print()">Imprimir / Guardar como PDF</button>
    </main>
  </body>
</html>`;
  const file = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  const safeReference = String(reservation.reference_code).replace(/[^a-z0-9-]/gi, '-');
  link.href = url;
  link.download = `rececao-viatura-${safeReference}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
