import logging
import time
from typing import Optional
from colab_cli.common import state
from colab_cli.commands.session import SessionState
from colab_cli.contents import ContentsClient

logger = logging.getLogger("colab_utils")

_last_mount_check_time = 0.0
_last_mount_check_result = False
_last_session_name = None
_last_session_adopt_time = 0.0

def ensure_session_adopted(force_refresh: bool = False) -> Optional[str]:
    """
    Ensures an active Colab server assignment is adopted with a fresh, valid token.
    Automatically refreshes expired JWT tokens from Google's active assignment.
    Caches active session name for 30s to avoid redundant remote API calls on every status poll.
    """
    global _last_session_name, _last_session_adopt_time
    now = time.time()
    if not force_refresh and _last_session_name and (now - _last_session_adopt_time < 30.0):
        try:
            if state.store.get(_last_session_name):
                return _last_session_name
        except Exception:
            pass

    try:
        # Clear cached sessions list so we get fresh state from disk/Google
        state._sessions = None
        assignments = state.client.list_assignments()
        
        # If assignments is empty, there are NO running Colab instances!
        if not assignments:
            logger.info("No active Colab server assignments found on Google. Pruning local store.")
            try:
                for name in list(state.store.list().keys()):
                    state.store.remove(name)
            except Exception:
                pass
            state._sessions = None
            _last_session_name = None
            _last_session_adopt_time = now
            return None

        a = assignments[0]
        local = state.store.list()
        matched_name = None

        for name, s in list(local.items()):
            if s.endpoint == a.endpoint:
                # Update token and URL to ensure they never expire
                s.token = a.runtime_proxy_info.token
                s.url = a.runtime_proxy_info.url
                state.store.add(s)
                matched_name = name
            else:
                # Prune old session that belonged to a terminated server endpoint
                try:
                    state.store.remove(name)
                except Exception:
                    pass

        if matched_name:
            _last_session_name = matched_name
            _last_session_adopt_time = now
            return matched_name

        # Adopt as clout_session with fresh token
        session_name = "clout_session"
        s = SessionState(
            name=session_name,
            token=a.runtime_proxy_info.token,
            url=a.runtime_proxy_info.url,
            endpoint=a.endpoint,
            variant=a.variant.name if hasattr(a.variant, "name") else "DEFAULT",
            accelerator=a.accelerator.value if hasattr(a.accelerator, "value") else "NONE"
        )
        state.store.add(s)
        state._sessions = None
        logger.info(f"Adopted active Colab server assignment {a.endpoint} as '{session_name}'")
        _last_session_name = session_name
        _last_session_adopt_time = now
        return session_name
    except Exception as e:
        logger.warning(f"ensure_session_adopted error: {e}")

    _last_session_name = None
    _last_session_adopt_time = now
    return None

def is_remote_drive_mounted(session_name: Optional[str] = None, force_refresh: bool = False) -> bool:
    """
    Accurately checks whether /content/drive/MyDrive exists and is mounted on the active Colab runtime.
    Caches positive results for 45 seconds to prevent slow network checks on every status poll.
    """
    global _last_mount_check_time, _last_mount_check_result
    now = time.time()

    # Fast path: If recently verified, return cached True immediately unless force_refresh
    if not force_refresh and _last_mount_check_result and (now - _last_mount_check_time < 45.0):
        return True

    try:
        s_name = session_name or ensure_session_adopted(force_refresh=force_refresh)
        if not s_name:
            _last_mount_check_result = False
            _last_mount_check_time = now
            return False
        s = state.store.get(s_name)
        if not s:
            _last_mount_check_result = False
            _last_mount_check_time = now
            return False
        c = ContentsClient(s)
        try:
            data = c.list_dir("content/drive")
            items = data.get("content", [])
            mounted = any(item.get("name") == "MyDrive" for item in items if isinstance(item, dict))
        except FileNotFoundError:
            mounted = False

        _last_mount_check_result = mounted
        _last_mount_check_time = now
        return mounted
    except FileNotFoundError:
        _last_mount_check_result = False
        _last_mount_check_time = now
        return False
    except BaseException as e:
        logger.debug(f"is_remote_drive_mounted check: {e}")
        # If Drive was verified mounted within 60s, transient latency or timeout should not flap status
        if not force_refresh and _last_mount_check_result and (now - _last_mount_check_time < 60.0):
            return True
        return False

def get_active_session_name(force_refresh: bool = False) -> Optional[str]:
    """Returns the name of the active, adopted Colab session, or None."""
    return ensure_session_adopted(force_refresh=force_refresh)
