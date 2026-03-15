import { Filter, Globe, Wifi } from "lucide-react";
import type { DiscoverFilter } from "@/hooks/useDiscover";

interface DiscoverFiltersProps {
  filters: DiscoverFilter;
  onFilterChange: (filters: DiscoverFilter) => void;
  countries: string[];
  totalCount: number;
  filteredCount: number;
}

const DiscoverFilters = ({ filters, onFilterChange, countries, totalCount, filteredCount }: DiscoverFiltersProps) => {
  return (
    <div className="mx-4 mt-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Gender filter */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/10 overflow-hidden text-xs">
          {["all", "male", "female"].map(g => (
            <button
              key={g}
              onClick={() => onFilterChange({ ...filters, gender: g })}
              className={`px-3 py-1.5 font-medium transition-colors capitalize ${
                filters.gender === g ? "bg-pink-500 text-white" : "text-white/60 hover:text-white"
              }`}
            >
              {g === "all" ? "All" : g}
            </button>
          ))}
        </div>

        {/* Country filter */}
        {countries.length > 0 && (
          <div className="relative">
            <select
              value={filters.country}
              onChange={(e) => onFilterChange({ ...filters, country: e.target.value })}
              className="appearance-none bg-white/5 border border-white/10 rounded-lg text-xs text-white/80 pl-7 pr-6 py-1.5 focus:outline-none focus:border-pink-500/50"
            >
              <option value="" className="bg-[#222]">All Countries</option>
              {countries.map(c => (
                <option key={c} value={c} className="bg-[#222]">{c}</option>
              ))}
            </select>
            <Globe className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
          </div>
        )}

        {/* Online only toggle */}
        <button
          onClick={() => onFilterChange({ ...filters, onlineOnly: !filters.onlineOnly })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            filters.onlineOnly
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
              : "bg-white/5 border-white/10 text-white/60 hover:text-white"
          }`}
        >
          <Wifi className="w-3.5 h-3.5" />
          Online Now
        </button>
      </div>

      {filteredCount !== totalCount && (
        <p className="text-white/40 text-xs">
          Showing {filteredCount} of {totalCount} members
        </p>
      )}
    </div>
  );
};

export default DiscoverFilters;
