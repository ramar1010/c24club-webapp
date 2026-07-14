import { Filter, Wifi } from "lucide-react";
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
