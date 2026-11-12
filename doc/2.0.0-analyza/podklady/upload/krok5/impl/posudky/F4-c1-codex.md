No finding. Without the core stopping the failed run, its held chunk remains, so the test fails when it expects only the second and third files in flight. It then checks that no later chunk or finish request was sent for the failed file.

The fixed 150 ms sleep is gone; progress is driven by held requests and checked with `vi.waitFor`. Tests were not run, as requested.