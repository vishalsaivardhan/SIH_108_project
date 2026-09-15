import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  ArrowUpRight, Check, CheckCircle2, ChevronRight, Clipboard, CloudUpload,
  FileText, LoaderCircle, Moon, Search, ShieldCheck, Sparkles, Sun, Upload,
  X, AlertCircle, Award, Zap,
} from "lucide-react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const SAMPLE_QUERIES = [
  "High strength deformed steel bars for concrete reinforcement",
  "Drinking water supplies intended for public consumption",
  "Ordinary Portland cement 43 grade specification",
];

function App() {
  const [query, setQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [tenderAnalysis, setTenderAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState("text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("is_procure_theme") || "light");
  const fileInputRef = useRef(null);
  const isDark = theme === "dark";

  useEffect(() => localStorage.setItem("is_procure_theme", theme), [theme]);

  const handleTextSearch = useCallback(async () => {
    if (!query.trim()) { setError("Please enter a procurement specification to analyze."); return; }
    setLoading(true); setError(""); setRecommendations([]); setTenderAnalysis(null);
    try {
      const response = await axios.post(`${API_URL}/api/recommend`, { text: query.trim(), top_k: 3 });
      setRecommendations(response.data.recommendations || []);
      setTenderAnalysis(response.data.tender_analysis || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Unable to connect to the analysis engine. Please ensure the FastAPI backend is running.");
    } finally { setLoading(false); }
  }, [query]);

  const handleFileChange = (event) => {
    setError("");
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;
    const allowedTypes = ["text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(uploadedFile.type) && !uploadedFile.name.endsWith(".txt")) {
      setError("Unsupported file format. Please upload TXT, PDF, or DOCX."); return;
    }
    setSelectedFile(uploadedFile);
  };

  const handleFileUpload = async (event) => {
    event.preventDefault();
    if (!selectedFile) { setError("Please select a document first."); return; }
    setLoading(true); setError(""); setRecommendations([]); setTenderAnalysis(null);
    try {
      const formData = new FormData(); formData.append("file", selectedFile);
      const response = await axios.post(`${API_URL}/api/upload-analyze`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      setRecommendations(response.data.recommendations || []);
      setTenderAnalysis(response.data.tender_analysis || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Document analysis failed. Please try again.");
    } finally { setLoading(false); }
  };

  const copyToClipboard = async (code) => {
    try { await navigator.clipboard.writeText(code); setCopiedCode(code); setTimeout(() => setCopiedCode(""), 2000); }
    catch { setError("Unable to copy the IS code."); }
  };
  const resetFile = () => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

  return (
    <div className={`app ${isDark ? "theme-dark" : "theme-light"}`}>
      <div className="paper-grid" />
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Lex Procure home"><span className="brand-mark"><Zap size={17} /></span><span><strong>lex<span>·</span>procure</strong><small>standards intelligence</small></span></a>
        <nav className="header-nav" aria-label="Main navigation"><a href="#analyzer">Analyzer</a><a href="#how-it-works">How it works</a><a href="#results">Standards library</a></nav>
        <div className="header-actions"><span className="live-status"><i /> Engine online</span><button className="icon-button" onClick={() => setTheme(isDark ? "light" : "dark")} aria-label="Toggle theme">{isDark ? <Sun size={17} /> : <Moon size={17} />}</button></div>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy"><p className="eyebrow"><Sparkles size={14} /> Indian standards, made searchable</p><h1>Clarity for the<br /><em>fine print.</em></h1><p className="hero-lede">Turn complex procurement language into confident, standards-ready decisions. Lex Procure reads between the lines so your team can move forward.</p><div className="hero-proof"><span className="proof-avatars"><b>IS</b><b>AI</b><b>✓</b></span><span>Built for the people who keep projects moving.</span></div></div>
          <div className="hero-orbit" aria-hidden="true"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-card card-top"><ShieldCheck size={16} /><span>Verified match</span><strong>94.8%</strong></div><div className="orbit-card card-bottom"><FileText size={16} /><span>IS 1786:2008</span><small>Reinforcing steel</small></div><div className="orbit-core"><span>lex</span><small>AI</small></div></div>
        </section>

        <section className="analyzer-section" id="analyzer"><div className="section-kicker"><span>01</span><span>Start with a requirement</span><i /></div><div className="workspace"><div className="workspace-heading"><div><p className="eyebrow">Your private standards desk</p><h2>What are you procuring?</h2></div><span className="workspace-note"><Zap size={14} /> Semantic matching</span></div><div className="mode-tabs"><button className={activeTab === "text" ? "active" : ""} onClick={() => { setActiveTab("text"); setError(""); }}><Search size={16} /> Describe requirement</button><button className={activeTab === "file" ? "active" : ""} onClick={() => { setActiveTab("file"); setError(""); }}><Upload size={16} /> Upload document</button></div>
          {activeTab === "text" ? <div className="input-panel"><textarea value={query} onChange={(event) => { setQuery(event.target.value); setError(""); }} placeholder="Paste a tender specification, material description, or technical note..." rows={5} /><div className="input-footer"><div className="sample-list">{SAMPLE_QUERIES.map((sample) => <button key={sample} onClick={() => setQuery(sample)}>{sample}</button>)}</div><button className="primary-button" disabled={loading} onClick={handleTextSearch}>{loading ? <LoaderCircle className="spin" size={17} /> : <ArrowUpRight size={17} />} {loading ? "Reading..." : "Find standards"}</button></div></div> : <form className="input-panel upload-panel" onSubmit={handleFileUpload}><input ref={fileInputRef} id="document-upload" type="file" accept=".txt,.pdf,.docx" onChange={handleFileChange} hidden />{!selectedFile ? <label htmlFor="document-upload" className="dropzone"><span className="upload-icon"><CloudUpload size={25} /></span><strong>Bring in a specification</strong><span>Drop a TXT, PDF, or DOCX here to begin</span><small>TXT · PDF · DOCX</small></label> : <div className="selected-file"><span className="file-icon"><FileText size={20} /></span><div><strong>{selectedFile.name}</strong><small>{(selectedFile.size / 1024).toFixed(1)} KB · Ready for analysis</small></div><button type="button" onClick={resetFile} aria-label="Remove file"><X size={16} /></button><button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} Process document</button></div>}</form>}
        </div>{error && <div className="error-message"><AlertCircle size={17} /><span>{error}</span><button onClick={() => setError("")}><X size={15} /></button></div>}</section>

        <section className="how-section" id="how-it-works"><div className="section-kicker"><span>02</span><span>How it works</span><i /></div><div className="steps"><Step number="01" title="Describe" text="Share the language your project already uses." icon={<FileText />} /><Step number="02" title="Understand" text="Our semantic engine reads the intent behind it." icon={<Sparkles />} /><Step number="03" title="Decide" text="Get standards you can trust, with context." icon={<CheckCircle2 />} /></div></section>
        {loading && !recommendations.length && <div className="loading-card"><LoaderCircle className="spin" size={24} /><div><strong>Reading your requirement</strong><span>Comparing BIS catalog matrices and normative references...</span></div></div>}
        {tenderAnalysis && !loading && <TenderAnalysis analysis={tenderAnalysis} />}
        {recommendations.length > 0 && !loading && <section className="results-section" id="results"><div className="results-heading"><div><div className="eyebrow"><CheckCircle2 size={14} /> Standards match</div><h2>Standards worth knowing</h2></div><span>{recommendations.length} recommendations</span></div><div className="results-list">{recommendations.map((item, index) => <ResultCard key={`${item.is_code}-${index}`} item={item} index={index} isDark={isDark} copiedCode={copiedCode} onCopy={copyToClipboard} />)}</div></section>}
      </main>
      <footer><span>lex·procure / standards intelligence</span><span><ShieldCheck size={15} /> Built for confident procurement</span></footer>
    </div>
  );
}

function Step({ number, title, text, icon }) { return <div className="step"><span className="step-number">{number}</span><div className="step-icon">{icon}</div><h3>{title}</h3><p>{text}</p></div>; }
function TenderAnalysis({ analysis }) {
  const checks = [...(analysis.certificate_checks || []), ...(analysis.requirement_checks || [])];
  return <section className="analysis-section" aria-label="Food tender verification"><div className="section-kicker"><span>03</span><span>Food tender verification</span><i /></div><div className="analysis-grid"><div className="rating-panel"><p className="eyebrow"><ShieldCheck size={14} /> Screening rating</p><strong className="rating-score">{analysis.score}<small>/100</small></strong><span className={`rating-label ${analysis.rating === "Ready for verification" ? "rating-ready" : "rating-risk"}`}>{analysis.rating}</span><p>{analysis.issue_count} issue{analysis.issue_count === 1 ? "" : "s"} need attention.</p></div><div className="checks-panel"><div className="analysis-heading"><h3>Evidence checklist</h3><span>Document-level screening</span></div><div className="check-list">{checks.map((check) => <div className="check-row" key={check.id}><span className={check.status === "evidence_found" ? "check-found" : "check-missing"}>{check.status === "evidence_found" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}</span><span>{check.label}</span><small>{check.status === "evidence_found" ? "Mentioned" : "Missing"}</small></div>)}</div></div></div>{analysis.issues?.length > 0 && <div className="issues-panel"><div className="analysis-heading"><h3>Issues to resolve</h3><span>{analysis.issues.length} flagged</span></div>{analysis.issues.map((issue, index) => <div className="issue-row" key={`${issue.area}-${index}`}><AlertCircle size={15} /><div><strong>{issue.message}</strong><span>{issue.action}</span></div><small>{issue.severity}</small></div>)}</div>}<p className="verification-note"><ShieldCheck size={14} /> {analysis.certificate_verification_note}</p></section>;
}
function ResultCard({ item, index, isDark, copiedCode, onCopy }) {
  const verified = item.verification_status === "Verified";
  const percentage = Math.min(100, Math.max(0, Number(item.similarity_score || 0) * 100));
  return <article className={`result-card ${isDark ? "dark-card" : ""}`}><div className="result-top"><span className="result-index">0{index + 1}</span><div className="result-code"><span>{item.is_code}</span><button onClick={() => onCopy(item.is_code)} aria-label="Copy IS code">{copiedCode === item.is_code ? <Check size={14} /> : <Clipboard size={14} />}</button></div><span className={`status ${verified ? "verified" : "review"}`}>{verified ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}{item.verification_status}</span></div><div className="result-title"><h3>{item.title}</h3><span>{percentage.toFixed(1)}% confidence</span></div><div className="confidence-bar"><i style={{ width: `${percentage}%` }} /></div><p className="scope">{item.scope}</p><div className="result-meta"><Info label="Category" value={item.category} /><Info label="Certifications" value={item.mandatory_certifications} icon={<Award size={13} />} /><Info label="Latest version" value={item.latest_version} /></div>{item.normative_references && <div className="references"><ChevronRight size={15} /><span><b>Normative references</b> {item.normative_references}</span></div>}</article>;
}
function Info({ label, value, icon }) { return <div><span>{icon}{label}</span><strong>{value || "Not specified"}</strong></div>; }
export default App;
