/**
 * WeatherConfigPanel
 * Configuration panel for Weather Data node using Open-Meteo API
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Cloud, ChatText, MagnifyingGlass, MapPin } from '@phosphor-icons/react';

interface WeatherConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

// Popular cities around the world with their coordinates
const WORLD_CITIES = [
  // Europe
  { name: 'Madrid, Spain', lat: 40.4168, lon: -3.7038, country: 'Spain' },
  { name: 'Barcelona, Spain', lat: 41.3851, lon: 2.1734, country: 'Spain' },
  { name: 'London, UK', lat: 51.5074, lon: -0.1278, country: 'United Kingdom' },
  { name: 'Paris, France', lat: 48.8566, lon: 2.3522, country: 'France' },
  { name: 'Berlin, Germany', lat: 52.5200, lon: 13.4050, country: 'Germany' },
  { name: 'Rome, Italy', lat: 41.9028, lon: 12.4964, country: 'Italy' },
  { name: 'Amsterdam, Netherlands', lat: 52.3676, lon: 4.9041, country: 'Netherlands' },
  { name: 'Vienna, Austria', lat: 48.2082, lon: 16.3738, country: 'Austria' },
  { name: 'Prague, Czech Republic', lat: 50.0755, lon: 14.4378, country: 'Czech Republic' },
  { name: 'Stockholm, Sweden', lat: 59.3293, lon: 18.0686, country: 'Sweden' },
  { name: 'Oslo, Norway', lat: 59.9139, lon: 10.7522, country: 'Norway' },
  { name: 'Copenhagen, Denmark', lat: 55.6761, lon: 12.5683, country: 'Denmark' },
  { name: 'Warsaw, Poland', lat: 52.2297, lon: 21.0122, country: 'Poland' },
  { name: 'Lisbon, Portugal', lat: 38.7223, lon: -9.1393, country: 'Portugal' },
  { name: 'Athens, Greece', lat: 37.9838, lon: 23.7275, country: 'Greece' },
  { name: 'Dublin, Ireland', lat: 53.3498, lon: -6.2603, country: 'Ireland' },
  { name: 'Brussels, Belgium', lat: 50.8503, lon: 4.3517, country: 'Belgium' },
  { name: 'Zurich, Switzerland', lat: 47.3769, lon: 8.5417, country: 'Switzerland' },
  { name: 'Moscow, Russia', lat: 55.7558, lon: 37.6173, country: 'Russia' },
  { name: 'Istanbul, Turkey', lat: 41.0082, lon: 28.9784, country: 'Turkey' },
  
  // North America
  { name: 'New York, USA', lat: 40.7128, lon: -74.0060, country: 'United States' },
  { name: 'Los Angeles, USA', lat: 34.0522, lon: -118.2437, country: 'United States' },
  { name: 'Chicago, USA', lat: 41.8781, lon: -87.6298, country: 'United States' },
  { name: 'Houston, USA', lat: 29.7604, lon: -95.3698, country: 'United States' },
  { name: 'Phoenix, USA', lat: 33.4484, lon: -112.0740, country: 'United States' },
  { name: 'Philadelphia, USA', lat: 39.9526, lon: -75.1652, country: 'United States' },
  { name: 'San Antonio, USA', lat: 29.4241, lon: -98.4936, country: 'United States' },
  { name: 'San Diego, USA', lat: 32.7157, lon: -117.1611, country: 'United States' },
  { name: 'Dallas, USA', lat: 32.7767, lon: -96.7970, country: 'United States' },
  { name: 'San Jose, USA', lat: 37.3382, lon: -121.8863, country: 'United States' },
  { name: 'Toronto, Canada', lat: 43.6532, lon: -79.3832, country: 'Canada' },
  { name: 'Vancouver, Canada', lat: 49.2827, lon: -123.1207, country: 'Canada' },
  { name: 'Montreal, Canada', lat: 45.5017, lon: -73.5673, country: 'Canada' },
  { name: 'Mexico City, Mexico', lat: 19.4326, lon: -99.1332, country: 'Mexico' },
  
  // South America
  { name: 'São Paulo, Brazil', lat: -23.5505, lon: -46.6333, country: 'Brazil' },
  { name: 'Rio de Janeiro, Brazil', lat: -22.9068, lon: -43.1729, country: 'Brazil' },
  { name: 'Buenos Aires, Argentina', lat: -34.6037, lon: -58.3816, country: 'Argentina' },
  { name: 'Lima, Peru', lat: -12.0464, lon: -77.0428, country: 'Peru' },
  { name: 'Bogotá, Colombia', lat: 4.7110, lon: -74.0721, country: 'Colombia' },
  { name: 'Santiago, Chile', lat: -33.4489, lon: -70.6693, country: 'Chile' },
  
  // Asia
  { name: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503, country: 'Japan' },
  { name: 'Shanghai, China', lat: 31.2304, lon: 121.4737, country: 'China' },
  { name: 'Beijing, China', lat: 39.9042, lon: 116.4074, country: 'China' },
  { name: 'Hong Kong, China', lat: 22.3193, lon: 114.1694, country: 'China' },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198, country: 'Singapore' },
  { name: 'Seoul, South Korea', lat: 37.5665, lon: 126.9780, country: 'South Korea' },
  { name: 'Bangkok, Thailand', lat: 13.7563, lon: 100.5018, country: 'Thailand' },
  { name: 'Mumbai, India', lat: 19.0760, lon: 72.8777, country: 'India' },
  { name: 'Delhi, India', lat: 28.6139, lon: 77.2090, country: 'India' },
  { name: 'Bangalore, India', lat: 12.9716, lon: 77.5946, country: 'India' },
  { name: 'Jakarta, Indonesia', lat: -6.2088, lon: 106.8456, country: 'Indonesia' },
  { name: 'Manila, Philippines', lat: 14.5995, lon: 120.9842, country: 'Philippines' },
  { name: 'Dubai, UAE', lat: 25.2048, lon: 55.2708, country: 'United Arab Emirates' },
  { name: 'Tel Aviv, Israel', lat: 32.0853, lon: 34.7818, country: 'Israel' },
  { name: 'Riyadh, Saudi Arabia', lat: 24.7136, lon: 46.6753, country: 'Saudi Arabia' },
  
  // Oceania
  { name: 'Sydney, Australia', lat: -33.8688, lon: 151.2093, country: 'Australia' },
  { name: 'Melbourne, Australia', lat: -37.8136, lon: 144.9631, country: 'Australia' },
  { name: 'Auckland, New Zealand', lat: -36.8485, lon: 174.7633, country: 'New Zealand' },
  
  // Africa
  { name: 'Cairo, Egypt', lat: 30.0444, lon: 31.2357, country: 'Egypt' },
  { name: 'Johannesburg, South Africa', lat: -26.2041, lon: 28.0473, country: 'South Africa' },
  { name: 'Lagos, Nigeria', lat: 6.5244, lon: 3.3792, country: 'Nigeria' },
  { name: 'Nairobi, Kenya', lat: -1.2921, lon: 36.8219, country: 'Kenya' },
  { name: 'Casablanca, Morocco', lat: 33.5731, lon: -7.5898, country: 'Morocco' },
].sort((a, b) => a.name.localeCompare(b.name));

export const WeatherConfigPanel: React.FC<WeatherConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup }) => {
  // Initialize selectedCity
  const initialSelectedCity = node?.config?.latitude && node?.config?.longitude
    ? WORLD_CITIES.find(c => 
        Math.abs(c.lat - node.config.latitude) < 0.01 && 
        Math.abs(c.lon - node.config.longitude) < 0.01
      ) || null
    : null;
  
  const [selectedCity, setSelectedCity] = useState<{ name: string; lat: number; lon: number; country: string } | null>(initialSelectedCity);
  const [citySearch, setCitySearch] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [latitude, setLatitude] = useState(node?.config?.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(node?.config?.longitude?.toString() || '');
  const [useCustomCoords, setUseCustomCoords] = useState(
    // Default to city selector mode; only use custom coords if there's a saved config with coords but no matching city
    node?.config?.latitude && node?.config?.longitude && !initialSelectedCity ? true : false
  );
  const [date, setDate] = useState(node?.config?.date || new Date().toISOString().split('T')[0]);
  const [forecastDays, setForecastDays] = useState(node?.config?.forecastDays?.toString() || '7');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCityDropdown(false);
      }
    };

    if (showCityDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCityDropdown]);

  // Filter cities based on search
  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return WORLD_CITIES.slice(0, 20); // Show first 20 by default
    const searchLower = citySearch.toLowerCase();
    return WORLD_CITIES.filter(city => 
      city.name.toLowerCase().includes(searchLower) ||
      city.country.toLowerCase().includes(searchLower)
    ).slice(0, 20);
  }, [citySearch]);

  const handleCitySelect = (city: { name: string; lat: number; lon: number; country: string }) => {
    setSelectedCity(city);
    setLatitude(city.lat.toString());
    setLongitude(city.lon.toString());
    setUseCustomCoords(false);
    setShowCityDropdown(false);
    setCitySearch('');
  };

  const handleSave = () => {
    const lat = useCustomCoords ? parseFloat(latitude) : (selectedCity?.lat || 40.4168);
    const lon = useCustomCoords ? parseFloat(longitude) : (selectedCity?.lon || -3.7038);
    
    onSave(nodeId, { 
      latitude: lat,
      longitude: lon,
      date,
      forecastDays: parseInt(forecastDays) || 7,
      cityName: selectedCity?.name || null
    });
    onClose();
  };

  const isConfigured = !!(node?.config?.latitude && node?.config?.longitude);

  const isOpen = !!nodeId;
  
  if (!nodeId) {
    return null;
  }
  
  return (
    <NodeConfigSidePanel
        isOpen={isOpen}
        onClose={() => onClose()}
        title="Configure Weather Data"
        icon={Cloud}
        footer={
            <>
                <button
                    onClick={() => onClose()}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={(!useCustomCoords && !selectedCity) || (useCustomCoords && (!latitude.trim() || !longitude.trim()))}
                    className="flex items-center px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
            <div className="space-y-5">
            {/* City Selector */}
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Location
                </label>
                
                {/* Toggle between city selector and custom coordinates */}
                <div className="flex items-center gap-2 mb-2">
                    <button
                        type="button"
                        onClick={() => {
                            setUseCustomCoords(false);
                            setShowCityDropdown(true);
                        }}
                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            !useCustomCoords
                                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                                : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-light)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                        <MapPin size={14} className="inline mr-1" />
                        Select City
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setUseCustomCoords(true);
                            setShowCityDropdown(false);
                        }}
                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            useCustomCoords
                                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                                : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-light)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                        Custom Coordinates
                    </button>
                </div>

                {!useCustomCoords ? (
                    <div className="relative" ref={dropdownRef}>
                        {/* Selected city display / Search input */}
                        <div
                            onClick={() => setShowCityDropdown(!showCityDropdown)}
                            className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus-within:ring-1 focus-within:ring-[var(--border-medium)] focus-within:border-[var(--border-medium)] cursor-pointer flex items-center gap-2"
                        >
                            <MagnifyingGlass size={14} className="text-[var(--text-tertiary)]" />
                            <input
                                type="text"
                                value={citySearch}
                                onChange={(e) => {
                                    setCitySearch(e.target.value);
                                    setShowCityDropdown(true);
                                }}
                                onFocus={() => setShowCityDropdown(true)}
                                placeholder={selectedCity ? selectedCity.name : "Search for a city..."}
                                className="flex-1 bg-transparent border-none outline-none placeholder:text-[var(--text-tertiary)]"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>

                        {/* Dropdown with cities */}
                        {showCityDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                {filteredCities.length > 0 ? (
                                    filteredCities.map((city) => (
                                        <button
                                            key={`${city.lat}-${city.lon}`}
                                            type="button"
                                            onClick={() => handleCitySelect(city)}
                                            className="w-full px-3 py-2 text-left text-xs hover:bg-[var(--bg-tertiary)] transition-colors border-b border-[var(--border-light)] last:border-b-0"
                                        >
                                            <div className="font-medium text-[var(--text-primary)]">{city.name}</div>
                                            <div className="text-[var(--text-secondary)] text-[10px]">{city.country}</div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-3 py-2 text-xs text-[var(--text-secondary)] text-center">
                                        No cities found
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedCity && !showCityDropdown && (
                            <div className="mt-2 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg">
                                <div className="text-xs font-medium text-[var(--text-primary)]">{selectedCity.name}</div>
                                <div className="text-[10px] text-[var(--text-secondary)]">
                                    {selectedCity.country} • {selectedCity.lat.toFixed(4)}, {selectedCity.lon.toFixed(4)}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <input
                                type="number"
                                step="any"
                                value={latitude}
                                onChange={(e) => setLatitude(e.target.value)}
                                placeholder="40.4168"
                                className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                            />
                            <p className="text-xs text-[var(--text-secondary)] mt-1">Latitude</p>
                        </div>
                        <div>
                            <input
                                type="number"
                                step="any"
                                value={longitude}
                                onChange={(e) => setLongitude(e.target.value)}
                                placeholder="-3.7038"
                                className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                            />
                            <p className="text-xs text-[var(--text-secondary)] mt-1">Longitude</p>
                        </div>
                    </div>
                )}
            </div>

            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Date
                </label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
                />
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Date for historical data or forecast start
                </p>
            </div>
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Forecast Days
                </label>
                <input
                    type="number"
                    min="1"
                    max="16"
                    value={forecastDays}
                    onChange={(e) => setForecastDays(e.target.value)}
                    placeholder="7"
                    className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                />
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Number of days to forecast (1-16, default: 7)
                </p>
            </div>
            <div className="p-3 border border-[var(--border-light)] rounded-lg bg-[var(--bg-tertiary)]">
                <p className="text-xs text-[var(--text-primary)] font-medium mb-1">Using Open-Meteo API:</p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                    Free weather API, no API key required. Provides current weather, forecasts, and historical data.
                </p>
            </div>
            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup?.('weather', 'Weather Data')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                >
                    <ChatText size={12} />
                    What would you like this node to do?
                </button>
            </div>
            </div>
    </NodeConfigSidePanel>
  );
};
