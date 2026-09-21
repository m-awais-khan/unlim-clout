import os

def patch_colab_cli():
    # 1. Patch jupyter_kernel_client for KernelClient alias and REQUEST_TIMEOUT
    try:
        import jupyter_kernel_client
        init_file = jupyter_kernel_client.__file__
        with open(init_file, "r") as f:
            content = f.read()
        if "KernelClient = JupyterKernelClient" not in content:
            with open(init_file, "a") as f:
                f.write("\nKernelClient = JupyterKernelClient\n")
            print("Patched jupyter_kernel_client with KernelClient alias.")
    except Exception as e:
        print(f"Failed to patch jupyter_kernel_client: {e}")

    try:
        import jupyter_kernel_client.constants as jkc_const
        const_file = jkc_const.__file__
        with open(const_file, "r") as f:
            c_text = f.read()
        if 'int(os.getenv("REQUEST_TIMEOUT", 30))' in c_text:
            c_text = c_text.replace('int(os.getenv("REQUEST_TIMEOUT", 30))', 'int(os.getenv("REQUEST_TIMEOUT", 86400))')
            with open(const_file, "w") as f:
                f.write(c_text)
            print("Patched jupyter_kernel_client REQUEST_TIMEOUT default to 86400s.")
    except Exception as e:
        print(f"Failed to patch jupyter_kernel_client REQUEST_TIMEOUT: {e}")

    # 2. Patch colab_cli execution.py to remove 30s hardcoded timeout
    try:
        import colab_cli.commands.execution as execution
        exec_file = execution.__file__
        with open(exec_file, "r") as f:
            exec_code = f.read()

        old_timeout = '] = 30.0,\n):'
        new_timeout = '] = 86400.0,\n):'
        if old_timeout in exec_code:
            exec_code = exec_code.replace(old_timeout, new_timeout)
            with open(exec_file, "w") as f:
                f.write(exec_code)
            print("Patched colab_cli execution.py default timeout from 30.0s to 86400.0s.")
        elif new_timeout in exec_code:
            print("colab_cli execution.py already patched for timeout.")
        else:
            import re
            patched, count = re.subn(
                r'(typer\.Option\("--timeout",\s*help="[^"]+"\),\s*\]\s*=\s*)30\.0,',
                r'\g<1>86400.0,',
                exec_code
            )
            if count > 0:
                with open(exec_file, "w") as f:
                    f.write(patched)
                print("Patched colab_cli execution.py default timeout via regex.")
    except Exception as e:
        print(f"Failed to patch colab_cli execution timeout: {e}")

    # 3. Patch colab_cli automation.py to avoid /dev/tty crash and auto-poll for Google Drive authorization
    try:
        import colab_cli.commands.automation as auto
        auto_file = auto.__file__
        with open(auto_file, "r") as f:
            auto_code = f.read()

        old_str = 'with open("/dev/tty") as tty:\n                    tty.readline()'
        robust_polling = '''# Poll for Google Drive browser authorization with stdin support and dryrun=true
                import time, select
                auth_confirmed = False
                poll_params = dict(params)
                poll_params["dryrun"] = "true"
                for _ in range(120):
                    try:
                        rlist, _, _ = select.select([sys.stdin], [], [], 0)
                        if rlist:
                            line = sys.stdin.readline()
                            if line and (line == "\\n" or len(line.strip()) > 0):
                                auth_confirmed = True
                                break
                    except Exception:
                        pass
                    time.sleep(2)
                    try:
                        g_resp = creds.request("GET", url, params=poll_params)
                        if get_status_code(g_resp) == 200:
                            t = json.loads(g_resp.text.split("\\n", 1)[-1]).get("token")
                            h = {"x-goog-colab-token": t}
                            p_resp = creds.request("POST", url, params=poll_params, headers=h, files={"file_id": (None, "empty.ipynb")})
                            if get_status_code(p_resp) == 200:
                                d = json.loads(p_resp.text.split("\\n", 1)[-1])
                                if d.get("success") is True:
                                    token = t
                                    headers = h
                                    auth_confirmed = True
                                    break
                    except Exception:
                        pass

                if not auth_confirmed:
                    typer.echo("\\n[colab] Drive authorization not confirmed. Mount cancelled.")
                    return False'''

        # Try replacing old_str or previous patch variations
        prev_patch_1 = '''# Poll for Google Drive browser authorization with stdin support and dryrun=true
                import time, select
                auth_confirmed = False
                poll_params = dict(params)
                poll_params["dryrun"] = "true"
                for _ in range(90):
                    try:
                        rlist, _, _ = select.select([sys.stdin], [], [], 0)
                        if rlist:
                            sys.stdin.readline()
                            auth_confirmed = True
                            break
                    except Exception:
                        pass
                    time.sleep(2)
                    try:
                        g_resp = creds.request("GET", url, params=poll_params)
                        if get_status_code(g_resp) == 200:
                            t = json.loads(g_resp.text.split("\\n", 1)[-1]).get("token")
                            h = {"x-goog-colab-token": t}
                            p_resp = creds.request("POST", url, params=poll_params, headers=h, files={"file_id": (None, "empty.ipynb")})
                            if get_status_code(p_resp) == 200:
                                d = json.loads(p_resp.text.split("\\n", 1)[-1])
                                if d.get("success") is True:
                                    token = t
                                    headers = h
                                    auth_confirmed = True
                                    break
                    except Exception:
                        pass'''

        prev_patch_2 = '''# Poll for Google Drive browser authorization without crashing on /dev/tty
                import time
                params["dryrun"] = "false"
                for _ in range(45):
                    time.sleep(2)
                    test_resp = creds.request(
                        "POST",
                        url,
                        params=params,
                        headers=headers,
                        files={"file_id": (None, "empty.ipynb")},
                    )
                    if get_status_code(test_resp) == 200:
                        resp = test_resp
                        break'''

        if old_str in auto_code:
            auto_code = auto_code.replace(old_str, robust_polling)
            with open(auto_file, "w") as f:
                f.write(auto_code)
            print("Patched colab_cli automation.py for headless Drive polling.")
        elif prev_patch_1 in auto_code:
            auto_code = auto_code.replace(prev_patch_1, robust_polling)
            with open(auto_file, "w") as f:
                f.write(auto_code)
            print("Updated colab_cli automation.py patch with robust non-EOF stdin check.")
        elif prev_patch_2 in auto_code:
            auto_code = auto_code.replace(prev_patch_2, robust_polling)
            with open(auto_file, "w") as f:
                f.write(auto_code)
            print("Updated colab_cli automation.py patch from prev_patch_2.")
        else:
            print("colab_cli automation.py already patched or pattern not found.")
    except Exception as e:
        print(f"Failed to patch colab_cli automation: {e}")

if __name__ == "__main__":
    patch_colab_cli()
