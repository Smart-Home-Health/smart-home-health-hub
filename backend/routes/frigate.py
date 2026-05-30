"""
Frigate NVR routes.

Sits alongside the generic /api/integrations endpoints and exposes Frigate-
specific operations (camera list, camera selection, live URL, event clip).

All endpoints are patient-scoped and require an enabled Frigate
PatientIntegration for that patient/account.
"""
import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional, List

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, StreamingResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from dependencies import get_db, require_read_access
from routes.auth import require_full_auth, get_current_account_id
from schemas.integration import (
    Integration as IntegrationModel,
    PatientIntegration,
    IntegrationDevice,
)
from integrations import get_integration
from integrations.frigate import FrigateIntegration


router = APIRouter(prefix="/api/integrations/frigate", tags=["frigate"])


# Persisted clip storage. Backed by the ./data host mount in docker-compose
# so saved videos survive container rebuilds.
CLIPS_ROOT = Path(os.getenv("FRIGATE_CLIPS_DIR", "/app/data/clips"))


def _clip_path(patient_id: int, camera: str, start: int, end: int) -> Path:
    # Camera names come from Frigate config and are already safe identifiers,
    # but strip path separators just in case.
    safe_cam = camera.replace("/", "_").replace("\\", "_")
    return CLIPS_ROOT / str(patient_id) / f"{safe_cam}_{int(start)}-{int(end)}.mp4"


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class FrigateCameraResponse(BaseModel):
    device_id: str
    device_name: Optional[str] = None
    is_enabled: bool = True
    selected: bool = False
    last_seen_at: Optional[datetime] = None


class FrigateSelectRequest(BaseModel):
    camera: str


class FrigateLiveResponse(BaseModel):
    camera: str
    live_url: str
    snapshot_url: str
    live_mode: str


class FrigateClipUrlsResponse(BaseModel):
    camera: str
    hls_url: str   # direct Frigate VOD playlist (for inline playback via hls.js)
    mp4_url: str   # our proxied download endpoint (Content-Disposition: attachment)
    start: int
    end: int


class FrigateClipStatusResponse(BaseModel):
    camera: str
    start: int
    end: int
    saved: bool
    file_size: Optional[int] = None
    saved_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_active_frigate(
    db: Session,
    patient_id: int,
    account_id: int,
) -> PatientIntegration:
    """Load the patient's active Frigate integration or 404."""
    pi = (
        db.query(PatientIntegration)
        .join(IntegrationModel, PatientIntegration.integration_id == IntegrationModel.id)
        .options(joinedload(PatientIntegration.integration))
        .filter(
            PatientIntegration.patient_id == patient_id,
            PatientIntegration.account_id == account_id,
            PatientIntegration.is_enabled == True,
            IntegrationModel.slug == "frigate",
        )
        .first()
    )
    if not pi:
        raise HTTPException(status_code=404, detail="Frigate integration not configured for this patient")
    return pi


def _make_client(pi: PatientIntegration) -> FrigateIntegration:
    cls = get_integration("frigate")
    if not cls:
        raise HTTPException(status_code=500, detail="Frigate integration not registered")
    return cls(pi)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/patient/{patient_id}/cameras", response_model=List[FrigateCameraResponse])
async def list_cameras(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_full_auth),
    account_id: int = Depends(get_current_account_id),
    _: bool = Depends(require_read_access),
):
    """List cameras discovered for this patient's Frigate integration."""
    pi = _get_active_frigate(db, patient_id, account_id)
    selected = (pi.settings or {}).get("camera")

    devices = (
        db.query(IntegrationDevice)
        .filter(IntegrationDevice.patient_integration_id == pi.id)
        .all()
    )

    return [
        FrigateCameraResponse(
            device_id=d.device_id,
            device_name=d.device_name,
            is_enabled=d.is_enabled,
            selected=d.device_id == selected,
            last_seen_at=d.last_seen_at,
        )
        for d in devices
    ]


@router.post("/patient/{patient_id}/select", response_model=FrigateCameraResponse)
async def select_camera(
    patient_id: int,
    data: FrigateSelectRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_full_auth),
    account_id: int = Depends(get_current_account_id),
):
    """Set the active camera for this patient."""
    pi = _get_active_frigate(db, patient_id, account_id)

    device = (
        db.query(IntegrationDevice)
        .filter(
            IntegrationDevice.patient_integration_id == pi.id,
            IntegrationDevice.device_id == data.camera,
        )
        .first()
    )
    if not device:
        raise HTTPException(
            status_code=404,
            detail=f"Camera '{data.camera}' not found - run discovery first",
        )

    settings = dict(pi.settings or {})
    settings["camera"] = data.camera
    pi.settings = settings
    pi.updated_at = datetime.utcnow()
    db.commit()

    return FrigateCameraResponse(
        device_id=device.device_id,
        device_name=device.device_name,
        is_enabled=device.is_enabled,
        selected=True,
        last_seen_at=device.last_seen_at,
    )


@router.get("/patient/{patient_id}/live", response_model=FrigateLiveResponse)
async def get_live(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_full_auth),
    account_id: int = Depends(get_current_account_id),
    _: bool = Depends(require_read_access),
):
    """Return live stream URL + snapshot URL for the selected camera."""
    pi = _get_active_frigate(db, patient_id, account_id)
    client = _make_client(pi)

    camera = client.selected_camera()
    if not camera:
        raise HTTPException(status_code=400, detail="No camera selected for this patient")

    return FrigateLiveResponse(
        camera=camera,
        live_url=client.get_live_url(camera),
        snapshot_url=client.get_snapshot_url(camera),
        live_mode=(pi.settings or {}).get("live_mode", "hls"),
    )


@router.get("/patient/{patient_id}/clip")
async def get_clip(
    patient_id: int,
    start: int = Query(..., description="Event start time (unix seconds)"),
    end: int = Query(..., description="Event end time (unix seconds)"),
    format: str = Query("mp4", regex="^(mp4|hls)$"),
    db: Session = Depends(get_db),
    current_user=Depends(require_full_auth),
    account_id: int = Depends(get_current_account_id),
    _: bool = Depends(require_read_access),
):
    """
    302-redirect to the recording clip on Frigate.

    `format=mp4` -> /api/<cam>/start/<s>/end/<e>/clip.mp4
    `format=hls` -> /vod/<cam>/start/<s>/end/<e>/master.m3u8
    """
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be > start")

    pi = _get_active_frigate(db, patient_id, account_id)
    client = _make_client(pi)

    camera = client.selected_camera()
    if not camera:
        raise HTTPException(status_code=400, detail="No camera selected for this patient")

    if format == "hls":
        url = client.get_vod_hls_url(camera, start, end)
    else:
        url = client.get_clip_url(camera, start, end)

    return RedirectResponse(url=url, status_code=302)


@router.get("/patient/{patient_id}/clip-urls", response_model=FrigateClipUrlsResponse)
async def get_clip_urls(
    patient_id: int,
    start: int = Query(..., description="Event start time (unix seconds)"),
    end: int = Query(..., description="Event end time (unix seconds)"),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_full_auth),
    account_id: int = Depends(get_current_account_id),
    _: bool = Depends(require_read_access),
):
    """
    Return URLs for inline playback (HLS) and downloadable MP4.

    `hls_url` points directly at Frigate so hls.js can stream it without
    needing to attach auth headers. `mp4_url` points at our /download
    endpoint, which proxies the bytes with a Content-Disposition header to
    trigger a real browser download.
    """
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be > start")

    pi = _get_active_frigate(db, patient_id, account_id)
    client = _make_client(pi)
    camera = client.selected_camera()
    if not camera:
        raise HTTPException(status_code=400, detail="No camera selected for this patient")

    base = str(request.base_url).rstrip("/") if request else ""
    mp4_url = f"{base}/api/integrations/frigate/patient/{patient_id}/download?start={start}&end={end}"

    return FrigateClipUrlsResponse(
        camera=camera,
        hls_url=client.get_vod_hls_url(camera, start, end),
        mp4_url=mp4_url,
        start=start,
        end=end,
    )


@router.get("/patient/{patient_id}/download")
async def download_clip(
    patient_id: int,
    start: int = Query(..., description="Event start time (unix seconds)"),
    end: int = Query(..., description="Event end time (unix seconds)"),
    inline: bool = Query(False, description="If true, serve with Content-Disposition: inline for <video> playback"),
    db: Session = Depends(get_db),
    current_user=Depends(require_full_auth),
    account_id: int = Depends(get_current_account_id),
    _: bool = Depends(require_read_access),
):
    """
    Stream the MP4 clip from Frigate.

    Defaults to `Content-Disposition: attachment` so the browser saves the
    file (needed for the `<a download>` button to work cross-origin). Pass
    `inline=1` to get `Content-Disposition: inline` for `<video>` playback.

    The clip range matches the user-configured `clip_padding_seconds`
    setting so the saved file lines up with what they see in the inline
    player.
    """
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be > start")

    pi = _get_active_frigate(db, patient_id, account_id)
    client = _make_client(pi)
    camera = client.selected_camera()
    if not camera:
        raise HTTPException(status_code=400, detail="No camera selected for this patient")

    upstream = client.get_clip_url(camera, start, end)
    filename = f"{camera}_{start}-{end}.mp4"

    async def stream():
        # Long timeout to allow Frigate to assemble the clip on demand.
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=120.0)) as http:
            async with http.stream("GET", upstream, headers=client._headers()) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    raise HTTPException(
                        status_code=502,
                        detail=f"Frigate returned {resp.status_code}: {body[:200].decode(errors='replace')}",
                    )
                async for chunk in resp.aiter_bytes(chunk_size=64 * 1024):
                    yield chunk

    disposition = "inline" if inline else "attachment"
    return StreamingResponse(
        stream(),
        media_type="video/mp4",
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Persisted clips (saved to ./data/clips/ on disk)
# ---------------------------------------------------------------------------


@router.get("/patient/{patient_id}/clips/status", response_model=FrigateClipStatusResponse)
async def get_clip_status(
    patient_id: int,
    start: int = Query(...),
    end: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_full_auth),
    account_id: int = Depends(get_current_account_id),
    _: bool = Depends(require_read_access),
):
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be > start")

    pi = _get_active_frigate(db, patient_id, account_id)
    client = _make_client(pi)
    camera = client.selected_camera()
    if not camera:
        raise HTTPException(status_code=400, detail="No camera selected for this patient")

    path = _clip_path(patient_id, camera, start, end)
    if path.exists():
        stat = path.stat()
        return FrigateClipStatusResponse(
            camera=camera, start=start, end=end,
            saved=True, file_size=stat.st_size,
            saved_at=datetime.utcfromtimestamp(stat.st_mtime),
        )
    return FrigateClipStatusResponse(camera=camera, start=start, end=end, saved=False)


@router.post("/patient/{patient_id}/clips", response_model=FrigateClipStatusResponse)
async def save_clip(
    patient_id: int,
    start: int = Query(...),
    end: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_full_auth),
    account_id: int = Depends(get_current_account_id),
):
    """Download the MP4 from Frigate and persist it under ./data/clips/."""
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be > start")

    pi = _get_active_frigate(db, patient_id, account_id)
    client = _make_client(pi)
    camera = client.selected_camera()
    if not camera:
        raise HTTPException(status_code=400, detail="No camera selected for this patient")

    path = _clip_path(patient_id, camera, start, end)
    path.parent.mkdir(parents=True, exist_ok=True)

    upstream = client.get_clip_url(camera, start, end)

    # Stream to a temp file in the same dir, then atomic-rename, so partial
    # writes don't leave a half-broken file in place.
    tmp_fd, tmp_path = tempfile.mkstemp(dir=path.parent, suffix=".part")
    os.close(tmp_fd)
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=120.0)) as http:
            async with http.stream("GET", upstream, headers=client._headers()) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    raise HTTPException(
                        status_code=502,
                        detail=f"Frigate returned {resp.status_code}: {body[:200].decode(errors='replace')}",
                    )
                with open(tmp_path, "wb") as f:
                    async for chunk in resp.aiter_bytes(chunk_size=64 * 1024):
                        f.write(chunk)
        os.replace(tmp_path, path)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise

    stat = path.stat()
    return FrigateClipStatusResponse(
        camera=camera, start=start, end=end,
        saved=True, file_size=stat.st_size,
        saved_at=datetime.utcfromtimestamp(stat.st_mtime),
    )


@router.get("/patient/{patient_id}/clips/file")
async def get_clip_file(
    patient_id: int,
    start: int = Query(...),
    end: int = Query(...),
    dl: bool = Query(False, description="If true, serve with Content-Disposition: attachment"),
    db: Session = Depends(get_db),
    current_user=Depends(require_full_auth),
    account_id: int = Depends(get_current_account_id),
    _: bool = Depends(require_read_access),
):
    """Serve a previously-saved clip from disk (with Range support for seeking)."""
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be > start")

    pi = _get_active_frigate(db, patient_id, account_id)
    client = _make_client(pi)
    camera = client.selected_camera()
    if not camera:
        raise HTTPException(status_code=400, detail="No camera selected for this patient")

    path = _clip_path(patient_id, camera, start, end)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Clip not saved yet")

    filename = path.name
    disposition = "attachment" if dl else "inline"
    return FileResponse(
        path=str(path),
        media_type="video/mp4",
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
    )


@router.delete("/patient/{patient_id}/clips")
async def delete_clip(
    patient_id: int,
    start: int = Query(...),
    end: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_full_auth),
    account_id: int = Depends(get_current_account_id),
):
    pi = _get_active_frigate(db, patient_id, account_id)
    client = _make_client(pi)
    camera = client.selected_camera()
    if not camera:
        raise HTTPException(status_code=400, detail="No camera selected for this patient")
    path = _clip_path(patient_id, camera, start, end)
    if path.exists():
        path.unlink()
    return {"deleted": True}
