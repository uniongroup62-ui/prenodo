"use client";

import { useEffect, useMemo, useState } from "react";

// Faithful port of the PHP "Livelli Card" section (app/pages/fidelity_points.php#livelli-card),
// surfaced as the standalone module ?page=fidelity_levels. In the legacy PHP app a GET to
// ?page=fidelity_levels redirects to ?page=fidelity_points (the levels card lives inside that
// page); the levels <form> posts to index.php?page=fidelity_levels with _mode=save_levels.
// This component reproduces that form VERBATIM (original Bootstrap markup, bi bi-* icons,
// inputs/labels/template) and pre-fills the level names and "Punti necessari" from the live
// /api/manage/configuration?module=fidelity_levels endpoint (Soglia Silver / Soglia Gold).

type ConfigRecord = {
  id: number;
  module: string;
  title: string;
  detail: string;
  value: string;
  active: boolean;
  updatedAt?: string;
};

type ConfigData = {
  ok: boolean;
  module?: { records?: ConfigRecord[] };
  records?: ConfigRecord[];
};

type Level = {
  key: string;
  name: string;
  points: string; // base level keeps "" (hidden input is 0); silver/gold show numeric points
  baseLevel: boolean;
};

function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/")[1] || "";
}

// Parse a "200 punti" style detail into a numeric points string ("200").
function pointsFromDetail(detail?: string): string {
  if (!detail) return "";
  const m = String(detail).match(/-?\d+/);
  return m ? m[0] : "";
}

// Default PHP levels (Bronze base + Silver/Gold) used until the API responds.
const DEFAULT_LEVELS: Level[] = [
  { key: "bronze", name: "Bronze", points: "0", baseLevel: true },
  { key: "silver", name: "Silver", points: "200", baseLevel: false },
  { key: "gold", name: "Gold", points: "500", baseLevel: false },
];

export function FidelityLevelsContent() {
  const slug = tenantSlug();

  const [levels, setLevels] = useState<Level[]>(DEFAULT_LEVELS);

  useEffect(() => {
    fetch(`/api/manage/configuration?slug=${encodeURIComponent(slug)}&module=fidelity_levels`, {
      headers: { "x-tenant-slug": slug },
    })
      .then((r) => r.json())
      .then((j: ConfigData) => {
        const records = j.module?.records ?? j.records ?? [];
        const silver = records.find((r) => /silver/i.test(r.title) || /silver/i.test(r.value));
        const gold = records.find((r) => /gold/i.test(r.title) || /gold/i.test(r.value));
        const silverPts = pointsFromDetail(silver?.detail) || "200";
        const goldPts = pointsFromDetail(gold?.detail) || "500";
        setLevels([
          { key: "bronze", name: "Bronze", points: "0", baseLevel: true },
          { key: "silver", name: silver?.value || "Silver", points: silverPts, baseLevel: false },
          { key: "gold", name: gold?.value || "Gold", points: goldPts, baseLevel: false },
        ]);
      })
      .catch(() => setLevels(DEFAULT_LEVELS));
  }, [slug]);

  function pageHref(page: string, suffix = ""): string {
    return `/${encodeURIComponent(slug)}/index.php?page=${page}${suffix}`;
  }

  const action = useMemo(() => pageHref("fidelity_levels"), [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateLevel(idx: number, patch: Partial<Level>) {
    setLevels((prev) => prev.map((lvl, i) => (i === idx ? { ...lvl, ...patch } : lvl)));
  }

  function removeLevel(idx: number) {
    setLevels((prev) => prev.filter((_, i) => i !== idx));
  }

  function addLevel() {
    setLevels((prev) => [...prev, { key: "", name: "", points: "", baseLevel: false }]);
  }

  return (
    <div className="container-fluid">
      <link rel="stylesheet" href="/assets/css/pages/fidelity_points.css" />

      <div className="bs-page-header">
        <div className="bs-page-heading">
          <div className="bs-page-kicker">Fidelity</div>
          <h1 className="bs-page-title">Livelli Card</h1>
          <div className="bs-page-subtitle">Definisci i livelli usati dalle campagne punti e dai vantaggi Fidelity.</div>
        </div>
        <div className="bs-page-actions">
          <a className="btn btn-light" href={`${pageHref("fidelity_points")}#livelli-card`}>
            <i className="bi bi-arrow-left" /> Punti
          </a>
        </div>
      </div>

      <div className="card p-4 mt-3 fidCampaignsCard " id="livelli-card" data-levels-card="1">
        <form method="post" action={action} className="row g-3" id="fidLevelsInlineForm">
          <input type="hidden" name="_mode" value="save_levels" />
          <input type="hidden" name="return_page" value="fidelity_points" />
          <input type="hidden" name="fidelity_levels_enabled" value="1" />
          <input type="hidden" name="fidelity_levels_points_enabled" value="1" />

          <div className="col-12 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div>
              <div className="h5 fw-bold m-0">Livelli Card</div>
              <div className="text-muted small">Definisci i livelli usati dalle campagne punti e dai vantaggi Fidelity.</div>
            </div>
          </div>

          <div className="col-12">
            <div className="alert alert-danger d-none mb-0" id="fidLevelsInlineError" role="alert" />
          </div>

          <div className="col-12">
            <div id="fidPointsLevelsList" className="d-flex flex-column gap-2">
              {levels.map((lvl, idx) => (
                <div
                  className="row g-2 align-items-end fidPointsLevelRow"
                  key={`${lvl.key}-${idx}`}
                  data-level-family="points"
                  data-level-key={lvl.key}
                  data-level-name={lvl.name}
                  data-base-level={lvl.baseLevel ? "1" : "0"}
                >
                  <input type="hidden" name="fidelity_points_level_keys[]" value={lvl.key} />

                  <div className="col-md-5">
                    <label className="form-label">Nome livello</label>
                    <input
                      className="form-control"
                      name="fidelity_points_level_names[]"
                      value={lvl.name}
                      placeholder="Es. Base"
                      onChange={(e) => updateLevel(idx, { name: e.target.value })}
                    />
                  </div>

                  {lvl.baseLevel ? (
                    <>
                      <input type="hidden" name="fidelity_points_level_points[]" value="0" />
                      <div className="col-md-7">
                        <div className="form-text text-muted mb-2">
                          Livello base predefinito: non eliminabile, punti bloccati a 0. Puoi modificare solo il nome.
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-md-6">
                        <label className="form-label">Punti necessari</label>
                        <div className="input-group">
                          <input
                            className="form-control"
                            type="number"
                            min="0"
                            step="1"
                            name="fidelity_points_level_points[]"
                            value={lvl.points}
                            onChange={(e) => updateLevel(idx, { points: e.target.value })}
                          />
                          <span className="input-group-text">Punti</span>
                        </div>
                      </div>

                      <div className="col-md-1 d-grid">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm fidPointsLevelRemove"
                          title="Rimuovi"
                          onClick={() => removeLevel(idx)}
                        >
                          <i className="bi bi-x-lg" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <template id="fidPointsLevelTpl">
              <div className="row g-2 align-items-end fidPointsLevelRow mt-2" data-level-family="points" data-level-key="" data-level-name="">
                <input type="hidden" name="fidelity_points_level_keys[]" value="" />
                <div className="col-md-5">
                  <label className="form-label">Nome livello</label>
                  <input className="form-control" name="fidelity_points_level_names[]" defaultValue="" placeholder="Es. Gold" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Punti necessari</label>
                  <div className="input-group">
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      step="1"
                      name="fidelity_points_level_points[]"
                      defaultValue=""
                      placeholder="Es. 200"
                    />
                    <span className="input-group-text">Punti</span>
                  </div>
                </div>
                <div className="col-md-1 d-grid">
                  <button type="button" className="btn btn-outline-danger btn-sm fidPointsLevelRemove" title="Rimuovi">
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
              </div>
            </template>
          </div>

          <div className="col-12 d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline-primary btn-sm" id="fidPointsLevelAdd" onClick={addLevel}>
              <i className="bi bi-plus-lg me-1" />
              Aggiungi livello
            </button>
            <button className="btn btn-primary btn-sm" type="submit">
              <i className="bi bi-check2-circle me-1" />
              Salva livelli
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
