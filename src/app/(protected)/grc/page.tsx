"use client";

export default function GRCDashboardPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="relative w-[600px] h-[600px]">
        {/* GRC Dashboard Infographic */}
        <svg viewBox="0 0 600 600" className="w-full h-full">
          <defs>
            <linearGradient id="outerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#0a1628' }} />
              <stop offset="100%" style={{ stopColor: '#1e3a5f' }} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background circle */}
          <circle cx="300" cy="300" r="280" fill="url(#outerGradient)" />

          {/* Outer ring */}
          <circle cx="300" cy="300" r="275" fill="none" stroke="#00d4ff" strokeWidth="2" opacity="0.3" />

          {/* Section labels around the outer ring - positioned clearly outside the inner circle */}
          {/* Governance - Top Left */}
          <text
            x="300"
            y="55"
            fill="#00d4ff"
            fontSize="22"
            fontWeight="bold"
            textAnchor="middle"
            filter="url(#glow)"
            transform="rotate(-45, 300, 300)"
          >
            Governance
          </text>

          {/* Risk Management - Top Right */}
          <text
            x="545"
            y="300"
            fill="#00d4ff"
            fontSize="18"
            fontWeight="bold"
            textAnchor="middle"
            filter="url(#glow)"
            transform="rotate(90, 545, 300)"
          >
            Risk Management
          </text>

          {/* Compliance - Bottom */}
          <text
            x="300"
            y="565"
            fill="#00d4ff"
            fontSize="22"
            fontWeight="bold"
            textAnchor="middle"
            filter="url(#glow)"
          >
            Compliance
          </text>

          {/* Inner circle border */}
          <circle cx="300" cy="300" r="190" fill="#0a1628" stroke="#00d4ff" strokeWidth="2" />

          {/* Star/Aperture segments */}
          <path d="M 300 110 L 370 210 L 300 300 Z" fill="#00d4ff" opacity="0.85" />
          <path d="M 370 210 L 490 235 L 420 330 L 300 300 Z" fill="#00d4ff" opacity="0.7" />
          <path d="M 420 330 L 455 450 L 340 400 L 300 300 Z" fill="#00d4ff" opacity="0.85" />
          <path d="M 340 400 L 260 400 L 300 300 Z" fill="#00d4ff" opacity="0.7" />
          <path d="M 260 400 L 145 450 L 180 330 L 300 300 Z" fill="#00d4ff" opacity="0.85" />
          <path d="M 180 330 L 110 235 L 230 210 L 300 300 Z" fill="#00d4ff" opacity="0.7" />
          <path d="M 230 210 L 300 110 L 300 300 Z" fill="#00d4ff" opacity="0.85" />

          {/* Center dark circle */}
          <circle cx="300" cy="300" r="95" fill="#0a1628" />
          <circle cx="300" cy="300" r="93" fill="none" stroke="#00d4ff" strokeWidth="1" opacity="0.5" />

          {/* Center text */}
          <text x="300" y="285" textAnchor="middle" fill="#00d4ff" fontSize="36" fontWeight="bold" filter="url(#glow)">
            GRC
          </text>
          <text x="300" y="310" textAnchor="middle" fill="#00d4ff" fontSize="12">
            Governance, Risk
          </text>
          <text x="300" y="328" textAnchor="middle" fill="#00d4ff" fontSize="12">
            Management &amp; Compliance
          </text>

          {/* Labels around the inner sections - positioned on the star points */}
          {/* Control Activities - Top Left point */}
          <text x="220" y="195" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Control</text>
          <text x="220" y="210" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Activities</text>

          {/* Audits - Left of Control Activities */}
          <text x="170" y="235" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Audits</text>

          {/* Strategy Management - Top Right point */}
          <text x="380" y="235" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Strategy</text>
          <text x="380" y="250" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Management</text>

          {/* Business Process - Right point */}
          <text x="435" y="330" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Business</text>
          <text x="435" y="345" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Process</text>

          {/* Policies & Procedures - Bottom Right point */}
          <text x="385" y="420" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Policies &amp;</text>
          <text x="385" y="435" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Procedures</text>

          {/* Performance Management - Bottom Left point */}
          <text x="215" y="420" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Performance</text>
          <text x="215" y="435" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Management</text>

          {/* Risk Management - Left point */}
          <text x="165" y="330" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Risk</text>
          <text x="165" y="345" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Management</text>
        </svg>
      </div>
    </div>
  );
}
