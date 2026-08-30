# SafeLink - AI Backend

FastAPI service implementing the risk, vulnerability, capacity, relocation
and scenario-simulation engines described in the root README.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs (Swagger): http://127.0.0.1:8000/docs

## Module map

| File | Responsibility |
|---|---|
| `app/main.py` | FastAPI routes / CORS |
| `app/models.py` | Pydantic request/response models |
| `app/data_loader.py` | Loads `app/data/*.json` sample data |
| `app/risk_engine.py` | Weighted risk score + risk level + explanation |
| `app/relocation_engine.py` | Vulnerability, relocation priority, destination ranking |
| `app/capacity_engine.py` | Safe-zone capacity ledger + capacity gap |
| `app/scenario_engine.py` | What-if adjustments + full pipeline orchestration |

All data in `app/data/` is **demo/sample data** for a fictional-but-geographically-consistent pilot district.
