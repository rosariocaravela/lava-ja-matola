function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function formatMoney(amount) {
  return `${Number(amount || 0).toLocaleString('pt-MZ')} MT`;
}

export function downloadPrebookingReceipt(reservation, businessName) {
  const estimate = Math.max(
    0,
    Number(reservation.price_mzn || 0) - Number(reservation.total_discount_mzn || 0)
  );
  const html = `<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Marcação ${escapeHtml(reservation.reference_code)} — Lava Já</title>
    <style>
      body { margin: 0; padding: 32px 16px; background: #f1f5f9; color: #0f172a; font: 15px/1.5 Arial, sans-serif; }
      main { box-sizing: border-box; max-width: 680px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 18px; background: white; }
      h1 { margin: 4px 0 8px; font-size: 25px; }
      .brand { color: #2563eb; font-size: 12px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; }
      .details { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 22px; padding: 18px; border-radius: 14px; background: #f8fafc; }
      .field span { display: block; color: #64748b; font-size: 13px; }
      .field strong { display: block; overflow-wrap: anywhere; }
      .price { display: flex; justify-content: space-between; gap: 16px; margin-top: 18px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 14px; font-size: 18px; font-weight: 700; }
      .notice { margin: 18px 0 0; padding: 16px; border: 1px solid #bfdbfe; border-radius: 14px; background: #eff6ff; color: #1e3a8a; }
      .print { display: block; margin: 22px auto 0; padding: 12px 20px; border: 0; border-radius: 10px; background: #2563eb; color: white; font-size: 15px; font-weight: 700; cursor: pointer; }
      @media (max-width: 480px) { .details { grid-template-columns: 1fr; } main { padding: 22px; } }
      @media print { body { padding: 0; background: white; } main { max-width: none; border: 0; } .print { display: none; } }
    </style>
  </head>
  <body>
    <main>
      <div class="brand">Lava Já</div>
      <h1>${reservation.booking_type === 'onsite' ? 'Comprovativo de marcação no local' : 'Comprovativo de pré-marcação'}</h1>
      <div>${escapeHtml(businessName || 'Estabelecimento Lava Já')}</div>
      <section class="details">
        <div class="field"><span>Referência</span><strong>${escapeHtml(reservation.reference_code)}</strong></div>
        <div class="field"><span>Estado do pedido</span><strong>${escapeHtml(reservation.status || 'reservado')}</strong></div>
        <div class="field"><span>Cliente</span><strong>${escapeHtml(reservation.customer_name)}</strong></div>
        <div class="field"><span>Viatura</span><strong>${escapeHtml(reservation.vehicle_model)} · ${escapeHtml(reservation.vehicle_plate)}</strong></div>
        <div class="field"><span>Serviço</span><strong>${escapeHtml(reservation.service_name)}</strong></div>
        <div class="field"><span>Modalidade</span><strong>${reservation.booking_type === 'onsite' ? 'Lavagem no local' : 'Nas instalações Lava Já'}</strong></div>
        ${reservation.booking_type === 'onsite' ? `<div class="field"><span>Endereço do atendimento</span><strong>${escapeHtml(reservation.location_address)}</strong></div>` : ''}
        <div class="field"><span>Data e hora</span><strong>${escapeHtml(reservation.scheduled_date)} às ${escapeHtml(reservation.scheduled_time)}</strong></div>
      </section>
      <div class="price"><span>Preço estimado</span><span>${escapeHtml(formatMoney(estimate))}</span></div>
      <p class="notice">Esta marcação não confirma pagamento nem conclusão do serviço. O valor final é confirmado após a realização do serviço.</p>
      <button class="print" onclick="window.print()">Imprimir / Guardar como PDF</button>
    </main>
  </body>
</html>`;
  const file = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  const safeReference = String(reservation.reference_code).replace(/[^a-z0-9-]/gi, '-');
  link.href = url;
  link.download = `marcacao-${safeReference}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
