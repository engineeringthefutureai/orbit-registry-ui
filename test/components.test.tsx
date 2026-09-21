import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ArtifactTable } from '../src/components/ArtifactTable';
import { SettingsModal } from '../src/components/SettingsModal';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfigProvider } from '../src/context/ConfigContext';
import { Artifact, ArtifactDetails, TagFailure } from '../src/api/registry';

vi.mock('../src/api/config', () => ({
  loadConfig: vi.fn().mockResolvedValue({ registryPublicUrl: 'test.registry.local:5000' }),
}));

describe('UI Components', () => {
  const mockArtifacts: Artifact[] = [
    {
      digest: 'sha256:1a440369deadbeef12345678',
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      tags: ['1.2.7', '1.2.7-20260920-0900', 'latest'],
    },
    {
      digest: 'sha256:ccfe53fadeadbeef12345678',
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      tags: ['1.2.7-20260919-0223', 'previous'],
    },
    {
      digest: 'sha256:9e02b1c4deadbeef12345678',
      mediaType: 'application/vnd.oci.image.index.v1+json',
      tags: ['1.2.6-multi'],
    },
    {
      digest: 'sha256:80af7318deadbeef12345678',
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      tags: ['1.2.5', 'keep-1.2.5'],
    },
  ];

  const mockDetailsMap = new Map<string, ArtifactDetails>([
    [
      'sha256:1a440369deadbeef12345678',
      {
        digest: 'sha256:1a440369deadbeef12345678',
        mediaType: 'application/vnd.oci.image.manifest.v1+json',
        isIndex: false,
        sizeBytes: 713 * 1000 * 1000,
        created: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        platforms: [
          {
            os: 'linux',
            architecture: 'amd64',
            digest: 'sha256:1a440369deadbeef12345678',
            sizeBytes: 713 * 1000 * 1000,
            layerCount: 5,
          },
        ],
        annotations: {},
      },
    ],
    [
      'sha256:9e02b1c4deadbeef12345678',
      {
        digest: 'sha256:9e02b1c4deadbeef12345678',
        mediaType: 'application/vnd.oci.image.index.v1+json',
        isIndex: true,
        sizeBytes: 1400 * 1000 * 1000,
        created: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        platforms: [
          {
            os: 'linux',
            architecture: 'amd64',
            digest: 'sha256:plat-amd64',
            sizeBytes: 700 * 1000 * 1000,
            layerCount: 4,
          },
          {
            os: 'linux',
            architecture: 'arm64',
            digest: 'sha256:plat-arm64',
            sizeBytes: 700 * 1000 * 1000,
            layerCount: 4,
          },
        ],
        annotations: {},
      },
    ],
  ]);

  const mockFailures: TagFailure[] = [
    { tag: 'failing-tag', status: 404 },
  ];

  const renderWithProviders = async (ui: React.ReactElement) => {
    let result: ReturnType<typeof render>;
    await act(async () => {
      result = render(
        <ConfigProvider>
          <ToastProvider>{ui}</ToastProvider>
        </ConfigProvider>,
      );
    });
    return result!;
  };

  it('renders ArtifactTable with header counts and artifact rows', async () => {
    await renderWithProviders(
      <ArtifactTable
        repo="agy/antigravity-daemon"
        artifacts={mockArtifacts}
        detailsMap={mockDetailsMap}
        failures={mockFailures}
        loadingDetails={false}
        totalTagsCount={9}
      />,
    );

    // Verify subheader count text: "4 artifacts · 9 tags · 1 tag failed to resolve [show]"
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('artifacts')).toBeDefined();
    expect(screen.getByText('9')).toBeDefined();
    expect(screen.getByText('tags')).toBeDefined();
    expect(screen.getByText(/1 tag failed to resolve/)).toBeDefined();
    expect(screen.getByText('[show]')).toBeDefined();

    // Verify tags are rendered
    expect(screen.getByText('1.2.7')).toBeDefined();
    expect(screen.getByText('latest')).toBeDefined();
    expect(screen.getByText('1.2.6-multi')).toBeDefined();

    // Verify digests truncated
    expect(screen.getByText('sha256:1a440369')).toBeDefined();
  });

  it('filters rows when searching tags or digests', async () => {
    await renderWithProviders(
      <ArtifactTable
        repo="agy/antigravity-daemon"
        artifacts={mockArtifacts}
        detailsMap={mockDetailsMap}
        failures={mockFailures}
        loadingDetails={false}
        totalTagsCount={9}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Search tags or digests...');
    fireEvent.change(searchInput, { target: { value: '1.2.6-multi' } });

    expect(screen.getByText('1.2.6-multi')).toBeDefined();
    expect(screen.queryByText('1.2.7')).toBeNull();
  });

  it('opens FailuresModal when clicking [show]', async () => {
    await renderWithProviders(
      <ArtifactTable
        repo="agy/antigravity-daemon"
        artifacts={mockArtifacts}
        detailsMap={mockDetailsMap}
        failures={mockFailures}
        loadingDetails={false}
        totalTagsCount={9}
      />,
    );

    fireEvent.click(screen.getByText('[show]'));
    expect(screen.getByText('Tag Resolution Failures')).toBeDefined();
    expect(screen.getByText('failing-tag')).toBeDefined();
    expect(screen.getByText('HTTP 404')).toBeDefined();
  });

  it('renders SettingsModal and handles cache clear', async () => {
    localStorage.setItem('orbit:details:v1:sha256:test', JSON.stringify({ digest: 'test' }));

    const onClose = vi.fn();
    await renderWithProviders(<SettingsModal onClose={onClose} />);

    expect(screen.getByText('Orbit Settings & Cache')).toBeDefined();
    expect(screen.getByText('Clear Cache')).toBeDefined();

    fireEvent.click(screen.getByText('Clear Cache'));
    expect(screen.getByText('Cleared')).toBeDefined();
  });
});
