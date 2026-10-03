"use client";

import { useMemo, useState } from "react";

export interface GeoRegion {
  id: string;
  name: string;
}
export interface GeoDepartment {
  id: string;
  regionId: string;
  name: string;
}
export interface GeoCommune {
  id: string;
  departmentId: string;
  name: string;
}

/**
 * Selection en cascade region -> departement -> commune (doc 03). Seul
 * le select "commune" est soumis dans le formulaire (name="communeId") —
 * region et departement ne servent qu'a filtrer la liste cote client.
 */
export function GeographyFields({
  regions,
  departments,
  communes,
}: {
  regions: GeoRegion[];
  departments: GeoDepartment[];
  communes: GeoCommune[];
}) {
  const [regionId, setRegionId] = useState(regions[0]?.id ?? "");

  const filteredDepartments = useMemo(
    () => departments.filter((d) => d.regionId === regionId),
    [departments, regionId]
  );
  const [departmentId, setDepartmentId] = useState(filteredDepartments[0]?.id ?? "");

  const effectiveDepartmentId = filteredDepartments.some((d) => d.id === departmentId)
    ? departmentId
    : filteredDepartments[0]?.id ?? "";

  const filteredCommunes = useMemo(
    () => communes.filter((c) => c.departmentId === effectiveDepartmentId),
    [communes, effectiveDepartmentId]
  );

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <select
        value={regionId}
        onChange={(e) => {
          setRegionId(e.target.value);
          setDepartmentId("");
        }}
        className="flex-1 min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
        aria-label="Région"
      >
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

      <select
        value={effectiveDepartmentId}
        onChange={(e) => setDepartmentId(e.target.value)}
        className="flex-1 min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
        aria-label="Département"
      >
        {filteredDepartments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <select
        name="communeId"
        required
        className="flex-1 min-h-[44px] rounded-md border border-gray-300 px-3 text-base"
        aria-label="Commune"
      >
        {filteredCommunes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
