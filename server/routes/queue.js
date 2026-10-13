const express = require('express');
const db = require('../db');
const { timeToMinutes, minutesToTime } = require('../utils/scheduling');

const router = express.Router();

// GET /api/queue - Live queue status & estimated wait time
router.get('/', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const settings = db.prepare('SELECT simultaneous_capacity, open_time, close_time FROM business_settings WHERE id = 1').get();
    const capacity = settings.simultaneous_capacity || 3;

    // Get all non-cancelled, non-completed services for today
    const activeQueue = db.prepare(`
      SELECT r.id, r.reference_code, r.customer_name, r.vehicle_plate, r.vehicle_model,
             r.scheduled_time, r.duration_minutes, r.end_time, r.bay_number, r.status,
             s.name as service_name, s.price_mzn, r.created_at
      FROM reservations r
      JOIN services s ON r.service_id = s.id
      WHERE r.scheduled_date = ?
        AND r.status IN ('em_atendimento', 'aguardando', 'reservado')
      ORDER BY 
        CASE r.status 
          WHEN 'em_atendimento' THEN 1 
          WHEN 'aguardando' THEN 2 
          WHEN 'reservado' THEN 3 
        END,
        r.scheduled_time ASC
    `).all(today);

    // Calculate dynamic queue positions and estimated wait times
    // Vehicles currently 'em_atendimento'
    const inService = activeQueue.filter(item => item.status === 'em_atendimento');
    // Vehicles 'aguardando'
    const waiting = activeQueue.filter(item => item.status === 'aguardando');
    // Vehicles 'reservado'
    const booked = activeQueue.filter(item => item.status === 'reservado');

    // Current bay occupancy breakdown
    const bayOccupancy = [];
    for (let b = 1; b <= capacity; b++) {
      const currentInBay = inService.find(s => s.bay_number === b);
      bayOccupancy.push({
        bayNumber: b,
        isOccupied: !!currentInBay,
        currentVehicle: currentInBay ? {
          plate: currentInBay.vehicle_plate,
          model: currentInBay.vehicle_model,
          service: currentInBay.service_name,
          startedAt: currentInBay.scheduled_time,
          estimatedEnd: currentInBay.end_time
        } : null
      });
    }

    // Assign queue positions & estimated wait time (approximate)
    let queuePosition = 1;
    const enrichedQueue = activeQueue.map(item => {
      let estimatedWaitMins = 0;
      let pos = null;

      if (item.status === 'em_atendimento') {
        pos = 'Em atendimento';
        estimatedWaitMins = 0;
      } else if (item.status === 'aguardando') {
        pos = queuePosition++;
        // Rough estimate based on average remaining time in bays divided by capacity
        estimatedWaitMins = Math.max(5, Math.round((pos * (item.duration_minutes || 30)) / capacity));
      } else {
        pos = 'Agendado';
        estimatedWaitMins = null;
      }

      return {
        ...item,
        queuePosition: pos,
        estimatedWaitMinutes: estimatedWaitMins,
        isApproximate: true
      };
    });

    res.json({
      date: today,
      capacity,
      bays: bayOccupancy,
      totalInQueue: waiting.length,
      totalInService: inService.length,
      totalBooked: booked.length,
      queue: enrichedQueue,
      notice: 'Os tempos de espera são estimativas aproximadas calculadas com base na duração e capacidade das vagas disponíveis.'
    });
  } catch (error) {
    console.error('Erro ao obter fila de atendimento:', error);
    res.status(500).json({ error: 'Erro ao calcular fila de atendimento.' });
  }
});

module.exports = router;
