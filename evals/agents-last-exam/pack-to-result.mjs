import { readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EvalDefSchema,
  ResultFileSchema,
  validateResultForEval,
} from "@evalhub/schemas";
import { parse as parseYaml } from "yaml";

const EVAL_ID = "agents-last-exam";
const RUNNER_VERSION = "agents-last-exam/pack-to-result@1.0.0";
const MANIFEST_VERSION = 1;
const PROTOCOL_REVISION = 1;
const UPSTREAM_COMMIT = "75a3f866535946b67f9a57e4f158eb30ad50be8a";
const MANIFEST_MAX_BYTES = 1_048_576;
const SHA256 = /^[0-9a-f]{64}$/u;
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._/:+-]{3,254}$/u;
const IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._/:+-]{0,254}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

// Fixed from selected_tasks/full/overall.txt at UPSTREAM_COMMIT.  This is only a
// manifest allowlist; it contains neither tasks, task assets, nor a runner.
const TASK_IDS = Object.freeze([
  "agriculture_env/crop_rotation_d02",
  "agriculture_env/ndvi_zonal_statistics_d02",
  "business_finance/american_option_pricing_ls",
  "business_finance/ar_full_1500",
  "business_finance/ar_full_300",
  "business_finance/basel_operational_risk_bia_cn",
  "business_finance/bpmn_category_governance_restructuring_l3",
  "business_finance/bpmn_supply_disruption_l3",
  "business_finance/digital_marketing_ab_test_analysis_1",
  "business_finance/digital_marketing_audience_segmentation_1",
  "business_finance/equity_research_summary",
  "business_finance/ff5_public_reconstruction",
  "business_finance/financial_stmt_reconstruction_aapl_fy2024",
  "business_finance/internal_employee_agent_instance_1",
  "business_finance/legal_ma_consistency_audit_01",
  "business_finance/llm_ecosystem_privacy_audit_realdata_1",
  "business_finance/metabase_bi_dashboard_01",
  "business_finance/odoo",
  "business_finance/pe_screening_memo_1",
  "business_finance/saas_onepager_brand_refresh_instance_1",
  "business_finance/sec_10k_financial_parsing",
  "business_finance/sse_northbound_programmatic_trading_01",
  "business_finance/taxform_4_1",
  "computing_math/branch_bound_atsp",
  "computing_math/cfr_game_theory_equilibrium",
  "computing_math/clustered_cyclic_code_circuit_level_simulation",
  "computing_math/cost_optimization_1",
  "computing_math/cp_test_gen_1",
  "computing_math/data_pipeline_etl_instance_1",
  "computing_math/dit_pipeline_cfg_alignment_fid_256_001",
  "computing_math/ghidra_malware_config_extraction_01",
  "computing_math/go_game_reconstruction_1",
  "computing_math/ising_post_measurement_1",
  "computing_math/k3_abelian_extensions",
  "computing_math/k8s_migration_1",
  "computing_math/k8s_payment_api_root_cause_analysis",
  "computing_math/mp_checkpoint_consolidation_v2",
  "computing_math/newyear_keygen2",
  "computing_math/os_log_permission_guard_v1",
  "computing_math/paper_reproduction_instance_1",
  "computing_math/particle_filter_nonlinear_tracking",
  "computing_math/pcap_enterprise_triage_01",
  "computing_math/ranking_node_feature_parity_recovery_instance_1",
  "computing_math/recsys_cold_start_instance_1",
  "computing_math/synthetic_causal_structure_inference",
  "computing_math/tris_crackme",
  "education_info/homework_grading_numerical_pdes_instance_02",
  "education_info/marc_remediation_folio_overlay",
  "education_info/moodle_gradebook_closeout_reconciliation",
  "education_info/yi_manuscript_translation_1",
  "engineering/2d_drawings_to_3d_building_model",
  "engineering/abb_irb6700_asset_to_urdf_instance_1",
  "engineering/aerospace_low_thrust_trajectory",
  "engineering/Analog_Active",
  "engineering/cailian_road_highway_alignment_2",
  "engineering/chisel_verilog_alignment_seq_1",
  "engineering/gcode",
  "engineering/humanoid_velocity_tracking_policy",
  "engineering/humanoid_wbc_policy_evaluation",
  "engineering/inner_support_elevation_optimization",
  "engineering/kicad_navswitch_library_integration_release_002",
  "engineering/mold-flow",
  "engineering/mpc_control_building_v1",
  "engineering/openroad_sky130_ibex_pnr_signoff",
  "engineering/pcb_layout_kicad_1",
  "engineering/power_10kv_feeder_reliability_001",
  "engineering/robotics_blender_tabletop_reconstruction",
  "engineering/sanding_performance_scoring_instance_1",
  "engineering/sumo_urban_am_peak_calibration",
  "health_medicine/causal_ihdp_ite_estimation_6a_v1",
  "health_medicine/Clinical_Variant_Annotation",
  "health_medicine/crf_sdtm_mapping_1",
  "health_medicine/crf_sdtm_mapping_4",
  "health_medicine/ct_geometry_calibration_catphan",
  "health_medicine/ecg_rhythm_conduction_ptbxl",
  "health_medicine/ecg_superclass_ptbxl",
  "health_medicine/epidemiology_forecast",
  "health_medicine/flusight_offline_hosp_forecast_2024_12_14",
  "health_medicine/healthcare_bias_audit_27a_public_replication_v1",
  "health_medicine/healthcare_sap_group_sequential_nsclc",
  "health_medicine/healthcare_tcga_luad_survival_kras",
  "health_medicine/healthcare_variant_annotation_pipeline",
  "health_medicine/limited_angle_ct_dps_reconstruction",
  "health_medicine/ltmle_targeted_bootstrap_simulation_study",
  "health_medicine/microdicom_nih_cxr_reader_adjudication",
  "health_medicine/nhanes_confounder_sensitivity_analysis",
  "health_medicine/nsclc_radiomics_cox_signature_v1",
  "health_medicine/obermeyer_bias_reproduction",
  "health_medicine/prostate_imrt_matrad_reproduction",
  "health_medicine/public_health_mask_mandate_ratio",
  "health_medicine/replicate_paper_1",
  "health_medicine/sa_aki_phenotyping",
  "health_medicine/scene3_skullstrip_qc",
  "health_medicine/simglucose_safe_basal_control_instance_1",
  "health_medicine/wsi_tumor_localization_1",
  "legal/agora_governance_classify_instance_1",
  "legal/legal_dr_fees_01",
  "life_sciences/amber_minimization_script_prep_instance_1",
  "life_sciences/amber_three_stage_mmgbsa_workflow_instance_1",
  "life_sciences/cell_tracking_instance_1",
  "life_sciences/cell_translocation_analysis",
  "life_sciences/gene_expression_differential_analysis_functional_enrichment_analysis_1",
  "life_sciences/genomic_interval_processing_1",
  "life_sciences/hg002_chr22_germline_variant_pipeline",
  "life_sciences/idp_ensemble_scoring",
  "life_sciences/merfish_image_decoding_segmentation",
  "life_sciences/protein_function_annotation_instance_1",
  "life_sciences/pseudotime_de",
  "life_sciences/rgi_mcr1_colistin_v2",
  "life_sciences/spatial_transcriptomics_spatial_domain_identification",
  "life_sciences/tcga_brca_deg_analysis",
  "life_sciences/tms_marrow_cell_type_annotation_instance_1",
  "life_sciences/tp53_locus_variant_histone_browser_svg",
  "life_sciences/WGS_Variant_Calling",
  "life_sciences/yeast_colony_detection",
  "life_sciences/zdock_hiv_dimer_interface_scoring_v1",
  "other/aerobics_wc2026_portugal_trio_difficulty_scoring",
  "other/mota_exploration",
  "physical_sciences/adapt_vqe_molecular_energy",
  "physical_sciences/climate_prediction",
  "physical_sciences/computational_materials_science",
  "physical_sciences/egt710_table1_smiles_extraction",
  "physical_sciences/exact_diag_heisenberg_j1j2",
  "physical_sciences/gillespie_gene_regulatory_network",
  "physical_sciences/glm_lake_calibration",
  "physical_sciences/hst_acs_wfc_visit_reduction",
  "physical_sciences/ketcher_smiles_reproduction",
  "physical_sciences/lenacapavir_sar_table2_extraction",
  "physical_sciences/molecular_structure_plausibility",
  "physical_sciences/mose2_bse_absorption_soc",
  "physical_sciences/phonon_dispersion_thermodynamics",
  "physical_sciences/qm9_mmff94_forcefield_survey_1",
  "physical_sciences/silicon_bse_absorption",
  "psychology_neuro/celegans_neuron_tracking",
  "psychology_neuro/reddit_ai_post_codebook_boolean_coding",
  "psychology_neuro/scene2_resample",
  "social_sciences/atwood_2022_measles_vaccine_reproduction",
  "transport_safety/abm_hangzhou_metro",
  "transport_safety/capacitated_vehicle_routing_problems",
  "transport_safety/fds_single_compartment_detector_reconstruction",
  "visual_media/atlas_outpost_graybox_navigation",
  "visual_media/blender_character_reconstruction_from_multiview_01",
  "visual_media/butterfly_flap_animation",
  "visual_media/chroma_key_from_reference",
  "visual_media/compress_3dgs_scene_ply",
  "visual_media/human_mesh_animation_reproduction",
  "visual_media/inkscape_cultural_poster_design",
  "visual_media/music_transcription",
  "visual_media/project_migration",
  "visual_media/skeletal_animation_reproduction",
  "visual_media/uv_reproduction",
  "visual_media/video_storyboard_001",
]);
const TASK_ID_SET = new Set(TASK_IDS);

function fail(message) {
  throw new Error(message);
}

function requireObject(value, field) {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    fail(`${field} must be an object`);
  }
  return value;
}

function requireKeys(object, keys, field) {
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${field} must contain exactly: ${expected.join(", ")}`);
  }
}

function requireString(value, field, pattern) {
  if (typeof value !== "string" || !pattern.test(value)) {
    fail(`${field} is invalid`);
  }
  return value;
}

function requireDate(value, field) {
  requireString(value, field, DATE);
  const [year, month, day] = value.split("-").map(Number);
  const normalized = new Date(Date.UTC(year, month - 1, day));
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month - 1 || normalized.getUTCDate() !== day) {
    fail(`${field} is not a calendar date`);
  }
  return value;
}

function parseArgs(argv) {
  if (argv.length !== 3 || argv[1] !== "--out" || argv[0].startsWith("-") || argv[2].startsWith("-")) {
    fail("usage: node evals/agents-last-exam/pack-to-result.mjs <manifest.json> --out <result.json>");
  }
  return { input: resolve(argv[0]), output: resolve(argv[2]) };
}

function parseManifest(inputPath) {
  const stat = statSync(inputPath);
  if (!stat.isFile() || stat.size > MANIFEST_MAX_BYTES) {
    fail(`input must be a regular JSON file no larger than ${MANIFEST_MAX_BYTES} bytes`);
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(inputPath, "utf8"));
  } catch (error) {
    fail(`input is not valid JSON: ${error.message}`);
  }
  requireObject(manifest, "manifest");
  requireKeys(manifest, ["manifest_version", "eval_id", "protocol_revision", "upstream_commit", "participant", "run_date", "task_results"], "manifest");
  if (manifest.manifest_version !== MANIFEST_VERSION || manifest.eval_id !== EVAL_ID || manifest.protocol_revision !== PROTOCOL_REVISION || manifest.upstream_commit !== UPSTREAM_COMMIT) {
    fail("manifest version, eval id, protocol revision, or upstream commit does not match this protocol");
  }
  const participant = requireObject(manifest.participant, "participant");
  const participantKeys = Object.keys(participant).sort();
  const fullParticipantKeys = ["harness", "harness_version", "model"];
  if (participantKeys.join("\u0000") !== ["model"].join("\u0000") && participantKeys.join("\u0000") !== fullParticipantKeys.join("\u0000")) {
    fail("participant must contain model alone, or model with harness and harness_version");
  }
  requireString(participant.model, "participant.model", MODEL_ID);
  if (participant.harness !== undefined) {
    requireString(participant.harness, "participant.harness", IDENTITY);
    requireString(participant.harness_version, "participant.harness_version", IDENTITY);
  }
  requireDate(manifest.run_date, "run_date");
  if (!Array.isArray(manifest.task_results) || manifest.task_results.length !== TASK_IDS.length) {
    fail(`task_results must contain exactly ${TASK_IDS.length} records`);
  }
  const seen = new Set();
  let sum = 0;
  for (const [index, entry] of manifest.task_results.entries()) {
    requireObject(entry, `task_results[${index}]`);
    requireKeys(entry, ["task_id", "score", "run_id", "run_sha256", "eval_result_sha256"], `task_results[${index}]`);
    if (typeof entry.task_id !== "string" || !TASK_ID_SET.has(entry.task_id) || seen.has(entry.task_id)) {
      fail(`task_results[${index}].task_id must be a unique ALE full task id`);
    }
    seen.add(entry.task_id);
    if (typeof entry.score !== "number" || !Number.isFinite(entry.score) || entry.score < 0 || entry.score > 1) {
      fail(`task_results[${index}].score must be a finite number in [0, 1]`);
    }
    requireString(entry.run_id, `task_results[${index}].run_id`, IDENTITY);
    requireString(entry.run_sha256, `task_results[${index}].run_sha256`, SHA256);
    requireString(entry.eval_result_sha256, `task_results[${index}].eval_result_sha256`, SHA256);
    sum += entry.score;
  }
  if (seen.size !== TASK_IDS.length) {
    fail("task_results does not cover the fixed ALE full task list");
  }
  return { participant, runDate: manifest.run_date, sum };
}

function writeResult(outputPath, result) {
  const temporary = resolve(dirname(outputPath), `.${Date.now()}-agents-last-exam-result.tmp`);
  if (temporary === outputPath) {
    fail("output path is invalid");
  }
  try {
    writeFileSync(temporary, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, outputPath);
  } catch (error) {
    try { unlinkSync(temporary); } catch { /* no temporary file to clean */ }
    fail(`unable to write output: ${error.message}`);
  }
}

function main() {
  const { input, output } = parseArgs(process.argv.slice(2));
  if (input === output) fail("input and output must be different files");
  const manifest = parseManifest(input);
  const score = (manifest.sum / TASK_IDS.length) * 100;
  const result = {
    eval_id: EVAL_ID,
    submission: { runner_version: RUNNER_VERSION, run_date: manifest.runDate },
    results: [{
      participant: manifest.participant,
      score,
      raw_metric: {
        label: "ALE full average task score × 100",
        value: `${manifest.sum.toFixed(6)} / ${TASK_IDS.length} × 100 = ${score.toFixed(6)}`,
      },
      detail: `Validated manifest for all ${TASK_IDS.length} tasks at ALE upstream commit ${UPSTREAM_COMMIT}; no task files were executed by this converter.`,
    }],
  };
  const evalPath = resolve(dirname(fileURLToPath(import.meta.url)), "eval.yaml");
  const evalDefinition = EvalDefSchema.parse(parseYaml(readFileSync(evalPath, "utf8")));
  ResultFileSchema.parse(result);
  const validation = validateResultForEval(evalDefinition, result);
  if (validation.length > 0) fail(validation.map((issue) => issue.message).join("; "));
  writeResult(output, result);
}

try {
  main();
} catch (error) {
  process.stderr.write(`agents-last-exam packer: ${error.message}\n`);
  process.exitCode = 1;
}
