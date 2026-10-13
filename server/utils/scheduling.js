const db = require('../db');

// Helper to convert "HH:MM" to minutes from midnight
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Helper to convert minutes from midnight to "HH:MM"
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Check slot availability for a given date, duration, and optional excluded reservation ID (for updates)
function checkAvailability(date, startTime, durationMinutes, excludeReservationId = null) {
  const settings = db.prepare('SELECT open_time, close_time, simultaneous_capacity FROM business_settings WHERE id = 1').get();
  const capacity = settings.simultaneous_capacity || 3;

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;
  const openMinutes = timeToMinutes(settings.open_time);
  const closeMinutes = timeToMinutes(settings.close_time);

  // Check if within operating hours
  if (startMinutes < openMinutes || endMinutes > closeMinutes) {
    return {
      available: false,
      reason: `Horário fora do funcionamento (${settings.open_time} às ${settings.close_time}).`
    };
  }

  // Check past date/time (in Maputo time UTC+2)
  const now = new Date();
  // Maputo is UTC+2
  const maputoNow = new Date(now.getTime() + (2 * 60 * 60 * 1000));
  const todayStr = maputoNow.toISOString().split('T')[0];
  const currentMinutes = maputoNow.getUTCHours() * 60 + maputoNow.getUTCMinutes();

  if (date < todayStr) {
    return {
      available: false,
      reason: 'Não é possível efetuar reservas em datas passadas.'
    };
  }

  if (date === todayStr && startMinutes <= currentMinutes) {
    return {
      available: false,
      reason: 'Este horário já passou no dia de hoje.'
    };
  }

  // Get active reservations on that date
  let query = `
    SELECT id, scheduled_time, duration_minutes, end_time, bay_number
    FROM reservations
    WHERE scheduled_date = ? 
      AND status NOT IN ('cancelado', 'concluido')
  `;
  const params = [date];

  if (excludeReservationId) {
    query += ' AND id != ?';
    params.push(excludeReservationId);
  }

  const existingReservations = db.prepare(query).all(...params);

  // Check each 5-minute slice within [startMinutes, endMinutes - 1] to ensure concurrency <= capacity
  for (let t = startMinutes; t < endMinutes; t += 5) {
    let concurrentCount = 0;
    for (const res of existingReservations) {
      const resStart = timeToMinutes(res.scheduled_time);
      const resEnd = timeToMinutes(res.end_time);
      if (t >= resStart && t < resEnd) {
        concurrentCount++;
      }
    }

    if (concurrentCount >= capacity) {
      return {
        available: false,
        reason: `A capacidade máxima de atendimento (${capacity} veículos em simultâneo) está preenchida para este intervalo.`,
        concurrentCount,
        capacity
      };
    }
  }

  // Determine available bay number (1 to capacity)
  const usedBays = new Set();
  for (const res of existingReservations) {
    const resStart = timeToMinutes(res.scheduled_time);
    const resEnd = timeToMinutes(res.end_time);
    if ((startMinutes >= resStart && startMinutes < resEnd) || (endMinutes > resStart && endMinutes <= resEnd) || (startMinutes <= resStart && endMinutes >= resEnd)) {
      if (res.bay_number) usedBays.add(res.bay_number);
    }
  }

  let assignedBay = 1;
  for (let b = 1; b <= capacity; b++) {
    if (!usedBays.has(b)) {
      assignedBay = b;
      break;
    }
  }

  return {
    available: true,
    assignedBay,
    capacity,
    endTime: minutesToTime(endMinutes)
  };
}

// Generate all available slots for a specific date and duration
function getAvailableSlots(date, durationMinutes = 30) {
  const settings = db.prepare('SELECT open_time, close_time, slot_interval_minutes, simultaneous_capacity FROM business_settings WHERE id = 1').get();
  const interval = settings.slot_interval_minutes || 30;
  const openMinutes = timeToMinutes(settings.open_time);
  const closeMinutes = timeToMinutes(settings.close_time);

  const slots = [];

  for (let m = openMinutes; m + durationMinutes <= closeMinutes; m += interval) {
    const timeStr = minutesToTime(m);
    const check = checkAvailability(date, timeStr, durationMinutes);

    slots.push({
      time: timeStr,
      endTime: minutesToTime(m + durationMinutes),
      available: check.available,
      reason: check.available ? null : check.reason,
      assignedBay: check.available ? check.assignedBay : null
    });
  }

  return {
    date,
    durationMinutes,
    capacity: settings.simultaneous_capacity,
    businessHours: { open: settings.open_time, close: settings.close_time },
    slots
  };
}

module.exports = {
  timeToMinutes,
  minutesToTime,
  checkAvailability,
  getAvailableSlots
};
