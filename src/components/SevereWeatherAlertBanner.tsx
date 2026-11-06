import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CloudLightning,
  ShieldAlert,
  Wind,
  X,
  ShieldCheck,
  Clock,
  MapPin,
  Flame,
} from 'lucide-react';

export interface WeatherAlert {
  id: string;
  code: number;
  severity: 'warning' | 'advisory' | 'watch';
  event: string;
  urgency: string;
  headline: string;
  description: string;
  precautions: string[];
  issuedAt?: string;
  expiresAt?: string;
}

export function evaluateSevereWeatherAlert({
  weatherCode,
  windSpeedKmh,
  windGustsKmh,
  locationName = 'this area',
  simulated = false,
}: {
  weatherCode: number;
  windSpeedKmh: number;
  windGustsKmh?: number;
  locationName?: string;
  simulated?: boolean;
}): WeatherAlert | null {
  if (simulated) {
    return {
      id: `alert-sim-${weatherCode}`,
      code: weatherCode,
      severity: 'warning',
      event: 'Severe Thunderstorm & Damaging Wind Warning',
      urgency: 'Immediate Action Required',
      headline: `Severe thunderstorm with potential for 70+ km/h wind gusts and localized hail detected near ${locationName}.`,
      description: `Meteorological radar indicates a fast-moving squall line capable of producing torrential downpours, frequent cloud-to-ground lightning, and damaging wind gusts in ${locationName}. Conditions are favorable for flash ponding and flying debris.`,
      precautions: [
        'Move indoors immediately and stay away from glass windows and exterior walls.',
        'Avoid driving through flooded underpasses or low-lying road depressions.',
        'Secure loose outdoor items, awnings, and lightweight patio furniture.',
        'Disconnect non-essential sensitive electronics to prevent power surge damage.',
      ],
      issuedAt: 'Updated live from radar feed',
      expiresAt: 'In effect for the next 2 hours',
    };
  }

  // Code 99: Severe Thunderstorm with Heavy Hail
  if (weatherCode === 99) {
    return {
      id: `alert-99-${weatherCode}`,
      code: 99,
      severity: 'warning',
      event: 'Severe Thunderstorm & Large Hail Warning',
      urgency: 'Immediate Shelter Advised',
      headline: `Destructive thunderstorm with large damaging hail and dangerous cloud-to-ground lightning in ${locationName}.`,
      description: `Radar telemetry reports intense convective storm cells producing large hail and violent downdrafts impacting ${locationName}. Severe threat to persons outdoors, vehicles, and roofs.`,
      precautions: [
        'Take shelter inside a sturdy reinforced structure immediately.',
        'Stay away from windows and avoid touching wired electrical appliances.',
        'Park vehicles under protective cover if safely possible.',
        'Do not venture outdoors until the squall line has completely cleared.',
      ],
      issuedAt: 'Active Live Alert',
      expiresAt: 'Expected to persist through current hour',
    };
  }

  // Code 96: Thunderstorm with Hail
  if (weatherCode === 96) {
    return {
      id: `alert-96-${weatherCode}`,
      code: 96,
      severity: 'warning',
      event: 'Severe Thunderstorm with Hail Warning',
      urgency: 'Action Recommended',
      headline: `Active thunderstorm accompanied by hail and localized heavy precipitation impacting ${locationName}.`,
      description: `Atmospheric convective instability has generated an active hail-bearing thunderstorm cell traversing ${locationName}.`,
      precautions: [
        'Remain indoors in an interior room until storm cells dissipate.',
        'Drive with extreme caution; road surfaces may become suddenly slick with hail pellets.',
        'Bring household pets indoors.',
      ],
      issuedAt: 'Active Live Alert',
      expiresAt: 'Expected in current storm window',
    };
  }

  // Code 95: Thunderstorm
  if (weatherCode === 95) {
    return {
      id: `alert-95-${weatherCode}`,
      code: 95,
      severity: 'advisory',
      event: 'Thunderstorm Advisory',
      urgency: 'Caution Advised',
      headline: `Active electrical storm with frequent lightning and localized downpours across ${locationName}.`,
      description: `Convective activity is producing lightning strikes and gusty conditions in the ${locationName} vicinity.`,
      precautions: [
        'When thunder roars, go indoors. Avoid open fields, elevated areas, and isolated trees.',
        'Postpone outdoor sports, swimming, and recreational activities.',
        'Monitor local weather updates for possible intensification.',
      ],
      issuedAt: 'Active Live Advisory',
      expiresAt: 'Active this hour',
    };
  }

  // Code 82: Violent Rain Showers
  if (weatherCode === 82) {
    return {
      id: `alert-82-${weatherCode}`,
      code: 82,
      severity: 'warning',
      event: 'Flash Flood & Violent Downpour Warning',
      urgency: 'Flash Flood Risk',
      headline: `Violent torrential rain cloudburst capable of rapid street flooding and poor visibility in ${locationName}.`,
      description: `Excessive rainfall rate exceeds soil absorption capacity, leading to rapid water accumulation on roadways, intersections, and low-lying ground.`,
      precautions: [
        'Turn Around, Don’t Drown: Never attempt to drive or walk through flooded roadways.',
        'Stay clear of culverts, creek beds, and storm runoff channels.',
        'Reduce vehicle speed significantly if travel cannot be postponed.',
      ],
      issuedAt: 'Active Flash Alert',
      expiresAt: 'In effect while shower cell passes',
    };
  }

  // Code 65: Heavy Rain
  if (weatherCode === 65) {
    return {
      id: `alert-65-${weatherCode}`,
      code: 65,
      severity: 'advisory',
      event: 'Heavy Rainfall Advisory',
      urgency: 'Travel Delay & Drainage Advisory',
      headline: `Sustained heavy rainfall impacting ${locationName} with localized pooling and low visibility.`,
      description: `Prolonged heavy precipitation may overwhelm localized storm drains and create hazardous hydroplaning conditions on highways.`,
      precautions: [
        'Allow extra commute time and increase following distance on all roads.',
        'Keep headlights illuminated and wipers on continuous cycle.',
        'Ensure basement drains and home gutters are unobstructed.',
      ],
      issuedAt: 'Live Rainfall Advisory',
      expiresAt: 'In effect today',
    };
  }

  // Code 75: Heavy Snow
  if (weatherCode === 75) {
    return {
      id: `alert-75-${weatherCode}`,
      code: 75,
      severity: 'warning',
      event: 'Winter Storm & Heavy Snow Warning',
      urgency: 'Hazardous Travel Warning',
      headline: `Heavy snowfall with rapid accumulation and reduced visibility affecting ${locationName}.`,
      description: `Significant snowfall rates are causing snow-covered roads and treacherous driving conditions across the region.`,
      precautions: [
        'Delay non-essential travel until road clearing crews have treated primary routes.',
        'Keep emergency winter supplies (blanket, flashlight, water) in your vehicle.',
        'Take frequent breaks when shoveling heavy snow to avoid heart strain.',
      ],
      issuedAt: 'Active Winter Warning',
      expiresAt: 'In effect today',
    };
  }

  // Code 67, 57: Freezing Rain / Freezing Drizzle
  if (weatherCode === 67 || weatherCode === 57) {
    return {
      id: `alert-ice-${weatherCode}`,
      code: weatherCode,
      severity: 'warning',
      event: 'Ice Storm & Freezing Rain Warning',
      urgency: 'Severe Black Ice Threat',
      headline: `Freezing rain creating dangerous ice glaze on road surfaces, sidewalks, and elevated overpasses in ${locationName}.`,
      description: `Supercooled precipitation freezes on contact with ground infrastructure, creating invisible black ice and tree branch hazards.`,
      precautions: [
        'Avoid driving unless an absolute emergency; overpasses and bridges freeze first.',
        'Exercise extreme care when walking on steps, porches, and untreated pavements.',
        'Be alert for fallen tree limbs and damaged utility power lines.',
      ],
      issuedAt: 'Active Ice Alert',
      expiresAt: 'In effect while temperatures remain sub-freezing',
    };
  }

  // Extreme Wind / Gale (> 55 km/h sustained or > 75 km/h gusts)
  if (windSpeedKmh >= 55 || (windGustsKmh && windGustsKmh >= 75)) {
    return {
      id: `alert-wind-${Math.round(windSpeedKmh)}`,
      code: weatherCode,
      severity: 'warning',
      event: 'High Wind & Gale Warning',
      urgency: 'Damaging Wind Threat',
      headline: `High winds of ${Math.round(windSpeedKmh)} km/h${windGustsKmh ? ` with peak gusts to ${Math.round(windGustsKmh)} km/h` : ''} impacting ${locationName}.`,
      description: `Gale-force atmospheric winds are causing difficult driving conditions for high-profile vehicles, with risk of tree limb damage and power outages.`,
      precautions: [
        'Secure or store outdoor trash bins, patio furniture, and garden tools.',
        'Use extra caution when driving on exposed bridges and open highway stretches.',
        'Stay clear of tall trees and report downed utility cables immediately.',
      ],
      issuedAt: 'Live Gale Warning',
      expiresAt: 'Active while high winds persist',
    };
  }

  return null;
}

export interface SevereWeatherAlertBannerProps {
  alert: WeatherAlert;
  onDismiss?: () => void;
  className?: string;
}

export function SevereWeatherAlertBanner({
  alert,
  onDismiss,
  className = '',
}: SevereWeatherAlertBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const isWarning = alert.severity === 'warning';

  if (isDismissed) {
    return (
      <motion.div
        className="severe-alert-collapsed-bar"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        style={{
          marginBottom: '16px',
          padding: '8px 14px',
          borderRadius: '12px',
          background: isWarning ? 'rgba(225, 29, 72, 0.12)' : 'rgba(217, 119, 6, 0.12)',
          border: isWarning ? '1px solid rgba(225, 29, 72, 0.3)' : '1px solid rgba(217, 119, 6, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: isWarning ? '#f43f5e' : '#f59e0b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <AlertTriangle size={14} />
          <span>Active {alert.event}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: '11px',
            textDecoration: 'underline',
            fontWeight: 500,
          }}
        >
          Show alert
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`severe-weather-alert-banner ${className}`}
      data-testid="banner-severe-weather-alert"
      role="alert"
      aria-live="assertive"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        marginBottom: '18px',
        borderRadius: '16px',
        overflow: 'hidden',
        background: isWarning
          ? 'linear-gradient(135deg, rgba(76, 5, 25, 0.94) 0%, rgba(95, 12, 34, 0.92) 50%, rgba(60, 4, 20, 0.94) 100%)'
          : 'linear-gradient(135deg, rgba(69, 26, 3, 0.94) 0%, rgba(90, 34, 4, 0.92) 50%, rgba(55, 20, 2, 0.94) 100%)',
        border: isWarning
          ? '1px solid rgba(244, 63, 94, 0.45)'
          : '1px solid rgba(245, 158, 11, 0.45)',
        boxShadow: isWarning
          ? '0 10px 28px rgba(225, 29, 72, 0.22), 0 0 1px rgba(244, 63, 94, 0.5)'
          : '0 10px 28px rgba(217, 119, 6, 0.2), 0 0 1px rgba(245, 158, 11, 0.5)',
        color: '#ffffff',
        position: 'relative',
        zIndex: 5,
      }}
    >
      {/* Alert Content Box */}
      <div style={{ padding: '16px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          {/* Icon Badge & Status */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: isWarning ? 'rgba(244, 63, 94, 0.22)' : 'rgba(245, 158, 11, 0.22)',
                border: isWarning ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                display: 'grid',
                placeItems: 'center',
                color: isWarning ? '#fb7185' : '#fcd34d',
                flexShrink: 0,
                marginTop: '1px',
              }}
            >
              <AlertTriangle size={18} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Kicker Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '3px',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    fontFamily: 'var(--app-font-mono)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: isWarning ? '#fda4af' : '#fde68a',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: isWarning ? '#f43f5e' : '#f59e0b',
                      boxShadow: isWarning ? '0 0 8px #f43f5e' : '0 0 8px #f59e0b',
                    }}
                  />
                  {alert.event}
                </span>

                <span
                  style={{
                    fontSize: '9.5px',
                    fontFamily: 'var(--app-font-mono)',
                    color: 'rgba(255, 255, 255, 0.7)',
                    background: 'rgba(0, 0, 0, 0.22)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {alert.urgency}
                </span>
              </div>

              {/* Primary Headline */}
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: 1.35,
                  margin: '0 0 4px 0',
                  color: '#ffffff',
                  letterSpacing: '-0.015em',
                }}
              >
                {alert.headline}
              </h3>

              {/* Timeframe & Source */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '10px',
                  fontFamily: 'var(--app-font-mono)',
                  color: 'rgba(255, 255, 255, 0.65)',
                }}
              >
                {alert.expiresAt && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} />
                    <span>{alert.expiresAt}</span>
                  </span>
                )}
                {alert.issuedAt && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldAlert size={11} />
                    <span>{alert.issuedAt}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Hide alert safety precautions' : 'View alert safety precautions'}
            >
              <span>{isExpanded ? 'Less' : 'Precautions'}</span>
              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsDismissed(true);
                onDismiss?.();
              }}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                color: 'rgba(255, 255, 255, 0.75)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s',
              }}
              title="Dismiss alert banner"
              aria-label="Dismiss alert banner"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Expandable Safety Details & Precautions */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.14)',
                overflow: 'hidden',
              }}
            >
              {/* Detailed Context Narrative */}
              <p
                style={{
                  fontSize: '12px',
                  lineHeight: 1.5,
                  margin: '0 0 12px 0',
                  color: 'rgba(255, 255, 255, 0.88)',
                }}
              >
                {alert.description}
              </p>

              {/* Recommended Safety Actions */}
              <div
                style={{
                  fontSize: '10.5px',
                  fontFamily: 'var(--app-font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 700,
                  color: isWarning ? '#fca5a5' : '#fde047',
                  marginBottom: '8px',
                }}
              >
                Recommended Immediate Actions:
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '8px',
                }}
              >
                {alert.precautions.map((precaution, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      lineHeight: 1.4,
                      color: 'rgba(255, 255, 255, 0.92)',
                    }}
                  >
                    <ShieldCheck
                      size={14}
                      style={{
                        color: isWarning ? '#fb7185' : '#fbbf24',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    />
                    <span>{precaution}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default SevereWeatherAlertBanner;
