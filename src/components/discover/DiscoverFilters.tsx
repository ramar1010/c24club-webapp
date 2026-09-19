import { Filter, Wifi, Link2 } from "lucide-react";
import type { DiscoverFilter } from "@/hooks/useDiscover";

interface DiscoverFiltersProps {
  filters: DiscoverFilter;
  onFilterChange: (filters: DiscoverFilter) => void;
  countries: string[];
  totalCount: number;
  filteredCount: number;
  linkedCount?: number;
}

const DiscoverFilters = ({ filters, onFilterChange, countries, totalCount, filteredCount, linkedCount = 0 }: DiscoverFiltersProps) => {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Gender filter */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/10 overflow-hidden text-xs shrink-0">
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

        {/* Linked only toggle */}
        {linkedCount > 0 && (
          <button
            onClick={() => onFilterChange({ ...filters, linkedOnly: !filters.linkedOnly })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors shrink-0 ${
              filters.linkedOnly
                ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                : "bg-white/5 border-white/10 text-white/60 hover:text-white"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            Linked ({linkedCount})
          </button>
        )}

        {/* Online only toggle */}
        <button
          onClick={() => onFilterChange({ ...filters, onlineOnly: !filters.onlineOnly })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors shrink-0 ${
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
