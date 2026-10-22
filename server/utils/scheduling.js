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
function checkAvailability(date, startTime, durationMinutes, excludeReservationId = null, bookingType = 'shop') {
  const settings = db.prepare(`
    SELECT open_time, close_time, slot_interval_minutes, simultaneous_capacity,
           onsite_open_time, onsite_close_time, onsite_slot_interval_minutes
    FROM business_settings WHERE id = 1
  `).get();
  const onsite = bookingType === 'onsite';
  const openTime = onsite ? settings.onsite_open_time : settings.open_time;
  const closeTime = onsite ? settings.onsite_close_time : settings.close_time;
  const interval = onsite
    ? settings.onsite_slot_interval_minutes
    : settings.slot_interval_minutes;
  const capacity = onsite ? 1 : (settings.simultaneous_capacity || 3);

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;
  const openMinutes = timeToMinutes(openTime);
  const closeMinutes = timeToMinutes(closeTime);

  // Check if within operating hours
  if (startMinutes < openMinutes || endMinutes > closeMinutes) {
    return {
      available: false,
      reason: `Horário fora do funcionamento (${openTime} às ${closeTime}).`
    };
  }

  if (onsite && (startMinutes - openMinutes) % interval !== 0) {
    return {
      available: false,
      reason: `As marcações no local são feitas de ${interval} em ${interval} minutos.`
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
      AND booking_type = ?
  `;
  const params = [date, bookingType];

  if (excludeReservationId) {
    query += ' AND id != ?';
    params.push(excludeReservationId);
  }

  const existingReservations = db.prepare(query).all(...params);

  if (existingReservations.some(reservation => reservation.scheduled_time === startTime)) {
    return {
      available: false,
      reason: 'Este horário já foi reservado. Escolha outro horário.'
    };
  }

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
function getAvailableSlots(date, durationMinutes = 30, bookingType = 'shop') {
  const settings = db.prepare(`
    SELECT open_time, close_time, slot_interval_minutes, simultaneous_capacity,
           onsite_open_time, onsite_close_time, onsite_slot_interval_minutes
    FROM business_settings WHERE id = 1
  `).get();
  const onsite = bookingType === 'onsite';
  const interval = onsite
    ? settings.onsite_slot_interval_minutes || 120
    : settings.slot_interval_minutes || 30;
  const openTime = onsite ? settings.onsite_open_time : settings.open_time;
  const closeTime = onsite ? settings.onsite_close_time : settings.close_time;
  const capacity = onsite ? 1 : settings.simultaneous_capacity;
  const openMinutes = timeToMinutes(openTime);
  const closeMinutes = timeToMinutes(closeTime);

  const slots = [];

  for (let m = openMinutes; m + durationMinutes <= closeMinutes; m += interval) {
    const timeStr = minutesToTime(m);
    const check = checkAvailability(date, timeStr, durationMinutes, null, bookingType);

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
    bookingType,
    intervalMinutes: interval,
    capacity,
    businessHours: { open: openTime, close: closeTime },
    slots
  };
}

module.exports = {
  timeToMinutes,
  minutesToTime,
  checkAvailability,
  getAvailableSlots
};
