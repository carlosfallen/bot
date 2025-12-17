// FILE: src/lib/business-hours.ts
// Sistema de horário comercial

export interface BusinessHoursConfig {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  workDays: number[]; // 0-6 (Dom-Sáb)
  timezone: string;
}

export function getBusinessHoursConfig(): BusinessHoursConfig {
  const startTime = process.env.WORK_HOURS_START || '08:00';
  const endTime = process.env.WORK_HOURS_END || '18:00';
  const workDaysStr = process.env.WORK_DAYS || '1,2,3,4,5';
  const workDays = workDaysStr.split(',').map(d => parseInt(d.trim()));
  const timezone = process.env.TZ || 'America/Fortaleza';

  return {
    startTime,
    endTime,
    workDays,
    timezone
  };
}

export function isBusinessHours(config?: BusinessHoursConfig): boolean {
  const cfg = config || getBusinessHoursConfig();

  // Criar data no timezone configurado
  const now = new Date();
  const localTime = now.toLocaleString('pt-BR', {
    timeZone: cfg.timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });

  const localDay = parseInt(
    now.toLocaleString('pt-BR', {
      timeZone: cfg.timezone,
      weekday: 'numeric'
    })
  );

  // Verificar se é dia útil
  if (!cfg.workDays.includes(localDay)) {
    return false;
  }

  // Verificar horário
  const [hours, minutes] = localTime.split(':').map(Number);
  const currentMinutes = hours * 60 + minutes;

  const [startHours, startMinutes] = cfg.startTime.split(':').map(Number);
  const startTotalMinutes = startHours * 60 + startMinutes;

  const [endHours, endMinutes] = cfg.endTime.split(':').map(Number);
  const endTotalMinutes = endHours * 60 + endMinutes;

  return currentMinutes >= startTotalMinutes && currentMinutes < endTotalMinutes;
}

export function getNextBusinessHoursMessage(config?: BusinessHoursConfig): string {
  const cfg = config || getBusinessHoursConfig();

  const now = new Date();
  const localDay = parseInt(
    now.toLocaleString('pt-BR', {
      timeZone: cfg.timezone,
      weekday: 'numeric'
    })
  );

  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // Se é dia útil mas fora do horário
  if (cfg.workDays.includes(localDay)) {
    const localTime = now.toLocaleString('pt-BR', {
      timeZone: cfg.timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });

    const [hours] = localTime.split(':').map(Number);

    // Se é antes do horário de abertura
    if (hours < parseInt(cfg.startTime.split(':')[0])) {
      return `Bom dia! Nosso horário de atendimento é das ${cfg.startTime} às ${cfg.endTime}. Retorno hoje às ${cfg.startTime}! 😊`;
    }

    // Se é depois do horário de fechamento
    return `Opa! Já encerramos o atendimento de hoje. Retorno amanhã às ${cfg.startTime}! 👍`;
  }

  // Se é fim de semana/feriado
  const nextWorkDay = getNextWorkDay(localDay, cfg.workDays);
  const nextDayName = dayNames[nextWorkDay];

  return `Olá! Estamos fora do expediente agora. Retorno na ${nextDayName} às ${cfg.startTime}! 😊`;
}

function getNextWorkDay(currentDay: number, workDays: number[]): number {
  let nextDay = (currentDay + 1) % 7;
  let attempts = 0;

  while (!workDays.includes(nextDay) && attempts < 7) {
    nextDay = (nextDay + 1) % 7;
    attempts++;
  }

  return nextDay;
}

export function formatBusinessHours(config?: BusinessHoursConfig): string {
  const cfg = config || getBusinessHoursConfig();

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const workDayNames = cfg.workDays.map(d => dayNames[d]);

  return `${workDayNames.join(', ')}: ${cfg.startTime} - ${cfg.endTime}`;
}
