import * as child_process from 'child_process';

import { HttpClient } from "..";

export function global_setup() {
    HttpClient.get_instance().set_base_url('http://localhost:9000/api/');
    HttpClient.get_instance().set_default_headers({
        // Note: Make sure the test server is using fake authentication.
        Cookie: `username=${SUPERUSER_NAME}`
    });

    subprocess_check_call('docker exec typescript-cli-django python3.6 manage.py migrate');
}

// Flushes all data from the test database and deletes the
// test media_root filesystem.
export function reset_db() {
    // Because of the overhead in flushing the database using manage.py flush,
    // we'll instead delete all objects in the "top-level" tables that all
    // the other data depends on.
    let delete_data = `import shutil
from django.core.cache import cache;
from django.contrib.auth.models import User
from autograder.core.models import Course, SandboxDockerImage
Course.objects.all().delete()
User.objects.all().delete()
SandboxDockerImage.objects.exclude(name='default').delete()

shutil.rmtree('/usr/src/app/media_root_dev/', ignore_errors=True)
cache.clear()
`;
    run_in_django_shell(delete_data);
}

export function run_in_django_shell(python_str: string) {
    // If you add -it to the docker command, be sure to set
    // stdio to ['inherit', ...] for stdin.
    let result = child_process.spawnSync(
        'docker', ['exec', 'typescript-cli-django', 'python3.6', 'manage.py', 'shell',
                   '-c', python_str]);
    let stdout = result.stdout.toString();
    let stderr = result.stderr.toString();
    if (result.status !== 0) {
        throw new Error('Running Django shell code failed:\n' + stdout + '\n' + stderr);
    }
    return {stdout: stdout, stderr: stderr, status: result.status};
}

// Runs the given command as a subprocess and throws an exception if the command fails.
function subprocess_check_call(cmd: string) {
    let result = child_process.spawnSync(cmd, {shell: true});
    let stdout = result.stdout.toString();
    let stderr = result.stderr.toString();
    if (result.status !== 0) {
        throw new Error(`Command "${cmd}" exited nonzero:\n${stdout}\n${stderr}`);
    }
}

export const SUPERUSER_NAME = 'jameslp@umich.edu';

export function make_superuser() {
    let make_superuser_code = `
from django.contrib.auth.models import User

user = User.objects.get_or_create(username='${SUPERUSER_NAME}')[0]
user.is_superuser = True
user.save()
        `;

    run_in_django_shell(make_superuser_code);
}

export function get_expected_editable_fields(python_class_name: string,
                                             model_location: string = "autograder.core.models") {
    let print_editable_fields = `
from ${model_location} import ${python_class_name}
print('\\n'.join(${python_class_name}.get_editable_fields()))
    `;
    let output = run_in_django_shell(print_editable_fields).stdout.trim();
    let expected = output.split(/\s+/);
    expected.sort();
    return expected;
}

export function do_editable_fields_test(ts_class: {EDITABLE_FIELDS: ReadonlyArray<string>},
                                        python_class_name: string,
                                        model_location: string = "autograder.core.models") {
    let expected = get_expected_editable_fields(python_class_name, model_location);
    let actual = ts_class.EDITABLE_FIELDS.slice();
    actual.sort();
    expect(actual).toEqual(expected);
}

export function sleep(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export function expect_dates_equal(first: string | null, second: string | null) {
    if (first === null || second === null) {
        expect(first).toEqual(second);
    }
    else {
        expect(new Date(first)).toEqual(new Date(second));
    }
}

export function expect_dates_not_equal(first: string | null, second: string | null) {
    if (first === null || second === null) {
        expect(first).not.toEqual(second);
    }
    else {
        expect(new Date(first)).not.toEqual(new Date(second));
    }
}

export function rand_bool() {
    return Math.random() < 0.5;
}

export function rand_int(max: number) {
    return Math.floor(Math.random() * max);
}

export function timeit(func: () => void, label: string) {
    let start = Date.now();
    func();
    let end = Date.now();
    console.log(`${label}: ${(end - start) / 1000}`);
}

export async function timeit_async(func: () => Promise<void>, label: string) {
    let start = Date.now();
    await func();
    let end = Date.now();
    console.log(`${label}: ${(end - start) / 1000}`);
}
